use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::{room, video};
use crate::error::{AppError, AppResult};
use crate::services::download::DownloadService;
use crate::services::room_manager::{RoomState, WsMessage};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub video_url: String,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct RoomResponse {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub video_url: Option<String>,
    pub status: String,
    pub video: Option<VideoResponse>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct VideoResponse {
    pub id: Uuid,
    pub title: Option<String>,
    pub status: String,
    pub download_progress: Option<f32>,
    pub duration: Option<f32>,
}

pub async fn create_room(
    State(state): State<AppState>,
    Json(payload): Json<CreateRoomRequest>,
) -> AppResult<Json<RoomResponse>> {
    let name = payload.name.trim();
    if name.is_empty() || name.len() > 128 {
        return Err(AppError::BadRequest("Room name must be 1-128 characters".to_string()));
    }

    // Basic URL validation
    let video_url = payload.video_url.trim();
    if video_url.is_empty() {
        return Err(AppError::BadRequest("Video URL is required".to_string()));
    }
    if !(video_url.starts_with("http://") || video_url.starts_with("https://")) {
        return Err(AppError::BadRequest("Invalid video URL".to_string()));
    }

    let room_id = Uuid::new_v4();
    let now = Utc::now();

    let room_model = room::ActiveModel {
        id: Set(room_id),
        name: Set(name.to_string()),
        owner_id: Set(payload.user_id),
        video_url: Set(Some(video_url.to_string())),
        status: Set("downloading".to_string()),
        created_at: Set(now.into()),
        last_active_at: Set(now.into()),
    };
    room_model.insert(&state.db).await?;

    // Create video record
    let video_id = Uuid::new_v4();
    let video_model = video::ActiveModel {
        id: Set(video_id),
        room_id: Set(room_id),
        source_url: Set(video_url.to_string()),
        title: Set(None),
        file_path: Set(None),
        file_size: Set(None),
        mime_type: Set(None),
        duration: Set(None),
        status: Set("pending".to_string()),
        download_progress: Set(Some(0.0)),
        created_at: Set(now.into()),
    };
    video_model.insert(&state.db).await?;

    // Initialize room state
    state.room_manager.insert(room_id, Arc::new(RoomState::new()));

    // Start download
    let download_service = DownloadService::new(
        state.db.clone(),
        state.room_manager.clone(),
        state.config.max_concurrent_downloads,
        state.config.video_storage_path.clone(),
        state.config.cookies_path.clone(),
    );
    download_service
        .start_download(video_id, room_id, video_url.to_string())
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(Json(RoomResponse {
        id: room_id,
        name: name.to_string(),
        owner_id: payload.user_id,
        video_url: Some(video_url.to_string()),
        status: "downloading".to_string(),
        video: Some(VideoResponse {
            id: video_id,
            title: None,
            status: "pending".to_string(),
            download_progress: Some(0.0),
            duration: None,
        }),
        created_at: now.to_rfc3339(),
    }))
}

pub async fn get_room(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> AppResult<Json<RoomResponse>> {
    let room_model = room::Entity::find_by_id(room_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    let video_model = video::Entity::find()
        .filter(video::Column::RoomId.eq(room_id))
        .order_by_desc(video::Column::CreatedAt)
        .one(&state.db)
        .await?;

    let video_resp = video_model.map(|v| VideoResponse {
        id: v.id,
        title: v.title,
        status: v.status,
        download_progress: v.download_progress,
        duration: v.duration,
    });

    Ok(Json(RoomResponse {
        id: room_model.id,
        name: room_model.name,
        owner_id: room_model.owner_id,
        video_url: room_model.video_url,
        status: room_model.status,
        video: video_resp,
        created_at: room_model.created_at.to_rfc3339(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct TransferOwnerRequest {
    pub new_owner_id: Uuid,
    pub requester_id: Uuid,
}

pub async fn transfer_owner(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<TransferOwnerRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let room_model = room::Entity::find_by_id(room_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Room not found".to_string()))?;

    if room_model.owner_id != payload.requester_id {
        return Err(AppError::Forbidden("Only room owner can transfer ownership".to_string()));
    }

    let mut active: room::ActiveModel = room_model.into();
    active.owner_id = Set(payload.new_owner_id);
    active.update(&state.db).await?;

    // Broadcast owner change
    if let Some(room_state) = state.room_manager.get(&room_id) {
        let _ = room_state.tx.send(WsMessage::RoomUpdate {
            owner_id: payload.new_owner_id,
            status: "active".to_string(),
        });
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

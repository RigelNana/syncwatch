use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, Query, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use chrono::Utc;
use futures::{SinkExt, StreamExt};
use sea_orm::EntityTrait;
use serde::Deserialize;
use uuid::Uuid;

use crate::routes::auth::decode_token;
use crate::services::room_manager::{
    ChatMsg, DanmakuMsg, RoomState, RoomUser, WsMessage,
};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<Uuid>,
    Query(query): Query<WsQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Verify token
    let claims = match decode_token(&query.token, &state.config.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return ws.on_upgrade(|mut socket| async move {
                let _ = socket
                    .send(Message::Text(
                        serde_json::to_string(&WsMessage::Error {
                            message: "Invalid token".to_string(),
                        })
                        .unwrap().into(),
                    ))
                    .await;
                let _ = socket.close().await;
            });
        }
    };

    let user_id = claims.sub;
    let nickname = claims.nickname;

    ws.on_upgrade(move |socket| handle_socket(socket, room_id, user_id, nickname, state))
}

async fn handle_socket(
    socket: WebSocket,
    room_id: Uuid,
    user_id: Uuid,
    nickname: String,
    state: AppState,
) {
    let (mut sender, mut receiver) = socket.split();

    // Ensure room state exists
    let room_state = state
        .room_manager
        .entry(room_id)
        .or_insert_with(|| Arc::new(RoomState::new()))
        .clone();

    // Get avatar color from DB
    let avatar_color = crate::entities::user::Entity::find_by_id(user_id)
        .one(&state.db)
        .await
        .ok()
        .flatten()
        .map(|u| u.avatar_color)
        .unwrap_or_else(|| "#60a5fa".to_string());

    let room_user = RoomUser {
        user_id,
        nickname: nickname.clone(),
        avatar_color: avatar_color.clone(),
        joined_at: Utc::now().timestamp_millis(),
    };

    // Add user to room
    room_state.users.insert(user_id, room_user.clone());

    // Broadcast user joined
    let _ = room_state.tx.send(WsMessage::UserJoined(room_user));

    // Send current sync state
    {
        let sync = room_state.sync.read().await;
        let msg = serde_json::to_string(&WsMessage::Sync(sync.clone())).unwrap();
        let _ = sender.send(Message::Text(msg.into())).await;
    }

    // Subscribe to room broadcasts
    let mut rx = room_state.tx.subscribe();

    // Task: forward broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let text = match serde_json::to_string(&msg) {
                Ok(t) => t,
                Err(_) => continue,
            };
            if sender.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    // Task: receive messages from client
    let room_state_recv = room_state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        handle_client_message(
                            &room_state_recv,
                            user_id,
                            &nickname,
                            &avatar_color,
                            ws_msg,
                        )
                        .await;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Remove user from room
    room_state.users.remove(&user_id);
    let _ = room_state.tx.send(WsMessage::UserLeft { user_id });

    tracing::info!("User {} left room {}", user_id, room_id);
}

async fn handle_client_message(
    room: &RoomState,
    user_id: Uuid,
    nickname: &str,
    avatar_color: &str,
    msg: WsMessage,
) {
    match msg {
        WsMessage::Play { timestamp, at } => {
            let mut sync = room.sync.write().await;
            // Last-write-wins with timestamp check
            if at >= sync.updated_at {
                sync.playing = true;
                sync.timestamp = timestamp;
                sync.updated_at = at;
                sync.updated_by = user_id;
                let _ = room.tx.send(WsMessage::Sync(sync.clone()));
            }
        }
        WsMessage::Pause { timestamp, at } => {
            let mut sync = room.sync.write().await;
            if at >= sync.updated_at {
                sync.playing = false;
                sync.timestamp = timestamp;
                sync.updated_at = at;
                sync.updated_by = user_id;
                let _ = room.tx.send(WsMessage::Sync(sync.clone()));
            }
        }
        WsMessage::Seek { timestamp, at } => {
            let mut sync = room.sync.write().await;
            if at >= sync.updated_at {
                sync.timestamp = timestamp;
                sync.updated_at = at;
                sync.updated_by = user_id;
                let _ = room.tx.send(WsMessage::Sync(sync.clone()));
            }
        }
        WsMessage::Speed { rate, at } => {
            let mut sync = room.sync.write().await;
            if at >= sync.updated_at {
                sync.speed = rate;
                sync.updated_at = at;
                sync.updated_by = user_id;
                let _ = room.tx.send(WsMessage::Sync(sync.clone()));
            }
        }
        WsMessage::Heartbeat { timestamp } => {
            // Heartbeat - just update server knowledge; no broadcast needed
            let mut sync = room.sync.write().await;
            // Only update if user is the one who last changed state
            if sync.updated_by == user_id {
                sync.timestamp = timestamp;
            }
        }
        WsMessage::Chat { content } => {
            if content.trim().is_empty() || content.len() > 1000 {
                return;
            }
            let _ = room.tx.send(WsMessage::ChatMessage(ChatMsg {
                id: Uuid::new_v4(),
                user_id,
                nickname: nickname.to_string(),
                avatar_color: avatar_color.to_string(),
                content,
                created_at: Utc::now().timestamp_millis(),
            }));
        }
        WsMessage::Danmaku { content, color } => {
            if content.trim().is_empty() || content.len() > 100 {
                return;
            }
            let sync = room.sync.read().await;
            let _ = room.tx.send(WsMessage::DanmakuMessage(DanmakuMsg {
                id: Uuid::new_v4(),
                user_id,
                content,
                color,
                timestamp: sync.timestamp,
            }));
        }
        _ => {}
    }
}

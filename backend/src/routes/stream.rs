use axum::{
    body::Body,
    extract::{Path, Request},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use sea_orm::EntityTrait;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use crate::error::AppError;
use crate::AppState;

pub async fn stream_video(
    axum::extract::State(state): axum::extract::State<AppState>,
    Path(video_id): Path<Uuid>,
    req: Request,
) -> Result<Response, AppError> {
    let video = crate::entities::video::Entity::find_by_id(video_id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Video not found".to_string()))?;

    if video.status != "ready" {
        return Err(AppError::BadRequest("Video is not ready yet".to_string()));
    }

    let file_path = video
        .file_path
        .as_deref()
        .ok_or_else(|| AppError::Internal("Video file path not set".to_string()))?;

    let file_size = video.file_size.unwrap_or(0) as u64;
    let mime = video
        .mime_type
        .as_deref()
        .unwrap_or("video/mp4");

    // Parse Range header
    let range_header = req
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let mut file = tokio::fs::File::open(file_path)
        .await
        .map_err(|e| AppError::Internal(format!("Cannot open video file: {}", e)))?;

    let actual_size = if file_size == 0 {
        file.metadata()
            .await
            .map(|m| m.len())
            .map_err(|e| AppError::Internal(format!("Cannot read file metadata: {}", e)))?
    } else {
        file_size
    };

    if let Some(range_str) = range_header {
        // Parse "bytes=START-END"
        let range = parse_range(&range_str, actual_size)
            .ok_or_else(|| AppError::BadRequest("Invalid range header".to_string()))?;

        let (start, end) = range;
        let content_length = end - start + 1;

        file.seek(std::io::SeekFrom::Start(start))
            .await
            .map_err(|e| AppError::Internal(format!("Seek failed: {}", e)))?;

        let limited = file.take(content_length);
        let stream = ReaderStream::new(limited);
        let body = Body::from_stream(stream);

        Ok(Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CONTENT_LENGTH, content_length.to_string())
            .header(
                header::CONTENT_RANGE,
                format!("bytes {}-{}/{}", start, end, actual_size),
            )
            .header(header::ACCEPT_RANGES, "bytes")
            .body(body)
            .unwrap()
            .into_response())
    } else {
        let stream = ReaderStream::new(file);
        let body = Body::from_stream(stream);

        Ok(Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CONTENT_LENGTH, actual_size.to_string())
            .header(header::ACCEPT_RANGES, "bytes")
            .body(body)
            .unwrap()
            .into_response())
    }
}

fn parse_range(range_str: &str, total: u64) -> Option<(u64, u64)> {
    let range_str = range_str.strip_prefix("bytes=")?;
    let mut parts = range_str.splitn(2, '-');
    let start_str = parts.next()?.trim();
    let end_str = parts.next()?.trim();

    let start: u64 = if start_str.is_empty() {
        // Suffix range: -500 means last 500 bytes
        let suffix: u64 = end_str.parse().ok()?;
        total.saturating_sub(suffix)
    } else {
        start_str.parse().ok()?
    };

    let end: u64 = if end_str.is_empty() {
        total - 1
    } else {
        end_str.parse().ok()?
    };

    if start > end || start >= total {
        return None;
    }

    let end = end.min(total - 1);
    Some((start, end))
}

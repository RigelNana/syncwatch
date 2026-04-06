use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Semaphore;
use uuid::Uuid;

use crate::entities::video;
use crate::services::room_manager::{RoomManager, WsMessage};

pub struct DownloadService {
    db: DatabaseConnection,
    room_manager: RoomManager,
    semaphore: Arc<Semaphore>,
    storage_path: PathBuf,
    cookies_path: Option<String>,
}

impl DownloadService {
    pub fn new(
        db: DatabaseConnection,
        room_manager: RoomManager,
        max_concurrent: usize,
        storage_path: String,
        cookies_path: Option<String>,
    ) -> Self {
        let path = PathBuf::from(&storage_path);
        std::fs::create_dir_all(&path).ok();
        Self {
            db,
            room_manager,
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            storage_path: path,
            cookies_path,
        }
    }

    pub async fn start_download(
        &self,
        video_id: Uuid,
        room_id: Uuid,
        source_url: String,
    ) -> anyhow::Result<()> {
        let db = self.db.clone();
        let room_manager = self.room_manager.clone();
        let semaphore = self.semaphore.clone();
        let storage_path = self.storage_path.clone();
        let cookies_path = self.cookies_path.clone();

        tokio::spawn(async move {
            let _permit = semaphore.acquire().await.unwrap();
            tracing::info!("Starting download for video {} from {}", video_id, source_url);

            let output_path = storage_path.join(format!("{}.mp4", video_id));
            let output_str = output_path.to_string_lossy().to_string();

            // Update status to downloading
            if let Ok(Some(model)) = video::Entity::find_by_id(video_id).one(&db).await {
                let mut active: video::ActiveModel = model.into();
                active.status = Set("downloading".to_string());
                let _ = active.update(&db).await;
            }

            Self::broadcast_progress(&room_manager, room_id, video_id, 0.0, "downloading");

            // Run yt-dlp
            let mut args = vec![
                "--newline".to_string(),
                "--no-playlist".to_string(),
                "--merge-output-format".to_string(), "mp4".to_string(),
                "-f".to_string(), "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best".to_string(),
                "-o".to_string(), output_str.clone(),
            ];
            if let Some(ref cp) = cookies_path {
                if std::path::Path::new(cp).exists() {
                    args.push("--cookies".to_string());
                    args.push(cp.clone());
                    tracing::info!("Using cookies file: {}", cp);
                }
            }
            args.push(source_url.clone());

            let mut child = match tokio::process::Command::new("yt-dlp")
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
            {
                Ok(child) => child,
                Err(e) => {
                    tracing::error!("Failed to spawn yt-dlp: {}", e);
                    Self::update_video_status(&db, video_id, "error").await;
                    Self::broadcast_progress(&room_manager, room_id, video_id, 0.0, "error");
                    return;
                }
            };

            // Capture stderr in a separate task
            let stderr_handle = if let Some(stderr) = child.stderr.take() {
                Some(tokio::spawn(async move {
                    let reader = BufReader::new(stderr);
                    let mut lines = reader.lines();
                    let mut stderr_output = String::new();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if !stderr_output.is_empty() {
                            stderr_output.push('\n');
                        }
                        stderr_output.push_str(&line);
                    }
                    stderr_output
                }))
            } else {
                None
            };

            // Parse progress from yt-dlp stdout
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    if let Some(progress) = Self::parse_progress(&line) {
                        Self::broadcast_progress(
                            &room_manager, room_id, video_id, progress, "downloading",
                        );
                        // Update DB periodically (every ~10%)
                        if (progress * 10.0) as i32 != ((progress - 0.01) * 10.0) as i32 {
                            if let Ok(Some(model)) = video::Entity::find_by_id(video_id).one(&db).await {
                                let mut active: video::ActiveModel = model.into();
                                active.download_progress = Set(Some(progress));
                                let _ = active.update(&db).await;
                            }
                        }
                    }
                }
            }

            let stderr_text = if let Some(handle) = stderr_handle {
                handle.await.unwrap_or_default()
            } else {
                String::new()
            };

            let status = child.wait().await;

            match status {
                Ok(s) if s.success() => {
                    tracing::info!("Download completed for video {}", video_id);

                    // Get file metadata
                    let file_size = tokio::fs::metadata(&output_path)
                        .await
                        .map(|m| m.len() as i64)
                        .ok();

                    // Get video info via yt-dlp
                    let title = Self::get_video_title(&source_url).await;
                    let duration = Self::get_video_duration(&output_str).await;

                    if let Ok(Some(model)) = video::Entity::find_by_id(video_id).one(&db).await {
                        let mut active: video::ActiveModel = model.into();
                        active.status = Set("ready".to_string());
                        active.file_path = Set(Some(output_str));
                        active.file_size = Set(file_size);
                        active.mime_type = Set(Some("video/mp4".to_string()));
                        active.download_progress = Set(Some(100.0));
                        active.title = Set(title);
                        active.duration = Set(duration);
                        let _ = active.update(&db).await;
                    }

                    Self::broadcast_progress(&room_manager, room_id, video_id, 100.0, "ready");
                }
                _ => {
                    tracing::error!("yt-dlp exited with error for video {}. stderr: {}", video_id, stderr_text);
                    Self::update_video_status(&db, video_id, "error").await;
                    Self::broadcast_progress(&room_manager, room_id, video_id, 0.0, "error");
                }
            }
        });

        Ok(())
    }

    fn parse_progress(line: &str) -> Option<f32> {
        // yt-dlp outputs lines like: [download]  45.2% of 123.45MiB at 5.67MiB/s
        if line.contains("[download]") && line.contains('%') {
            let pct = line
                .split_whitespace()
                .find(|s| s.ends_with('%'))?
                .trim_end_matches('%')
                .parse::<f32>()
                .ok()?;
            Some(pct)
        } else {
            None
        }
    }

    fn broadcast_progress(
        room_manager: &RoomManager,
        room_id: Uuid,
        video_id: Uuid,
        progress: f32,
        status: &str,
    ) {
        if let Some(room) = room_manager.get(&room_id) {
            let _ = room.tx.send(WsMessage::DownloadProgress {
                video_id,
                progress,
                status: status.to_string(),
            });
        }
    }

    async fn update_video_status(db: &DatabaseConnection, video_id: Uuid, status: &str) {
        if let Ok(Some(model)) = video::Entity::find_by_id(video_id).one(db).await {
            let mut active: video::ActiveModel = model.into();
            active.status = Set(status.to_string());
            let _ = active.update(db).await;
        }
    }

    async fn get_video_title(url: &str) -> Option<String> {
        let output = tokio::process::Command::new("yt-dlp")
            .args(["--get-title", "--no-playlist", url])
            .output()
            .await
            .ok()?;
        if output.status.success() {
            let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if title.is_empty() { None } else { Some(title) }
        } else {
            None
        }
    }

    async fn get_video_duration(file_path: &str) -> Option<f32> {
        let output = tokio::process::Command::new("ffprobe")
            .args([
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
            ])
            .output()
            .await
            .ok()?;
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<f32>()
                .ok()
        } else {
            None
        }
    }
}

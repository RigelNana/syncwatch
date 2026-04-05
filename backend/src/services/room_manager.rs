use std::sync::Arc;

use chrono::Utc;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomUser {
    pub user_id: Uuid,
    pub nickname: String,
    pub avatar_color: String,
    pub joined_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    // Client -> Server
    Play { timestamp: f64, at: i64 },
    Pause { timestamp: f64, at: i64 },
    Seek { timestamp: f64, at: i64 },
    Speed { rate: f64, at: i64 },
    Heartbeat { timestamp: f64 },
    Chat { content: String },
    Danmaku { content: String, color: String },

    // Server -> Client
    Sync(SyncState),
    ChatMessage(ChatMsg),
    DanmakuMessage(DanmakuMsg),
    UserJoined(RoomUser),
    UserLeft { user_id: Uuid },
    DownloadProgress { video_id: Uuid, progress: f32, status: String },
    RoomUpdate { owner_id: Uuid, status: String },
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub playing: bool,
    pub timestamp: f64,
    pub speed: f64,
    pub updated_at: i64,
    pub updated_by: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub id: Uuid,
    pub user_id: Uuid,
    pub nickname: String,
    pub avatar_color: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DanmakuMsg {
    pub id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub color: String,
    pub timestamp: f64,
}

pub struct RoomState {
    pub sync: tokio::sync::RwLock<SyncState>,
    pub users: DashMap<Uuid, RoomUser>,
    pub tx: broadcast::Sender<WsMessage>,
}

impl RoomState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(256);
        Self {
            sync: tokio::sync::RwLock::new(SyncState {
                playing: false,
                timestamp: 0.0,
                speed: 1.0,
                updated_at: Utc::now().timestamp_millis(),
                updated_by: Uuid::nil(),
            }),
            users: DashMap::new(),
            tx,
        }
    }
}

pub type RoomManager = Arc<DashMap<Uuid, Arc<RoomState>>>;

pub fn new_room_manager() -> RoomManager {
    Arc::new(DashMap::new())
}

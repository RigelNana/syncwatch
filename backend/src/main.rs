use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    routing::{get, post},
    Router,
};
use sea_orm::{Database, DatabaseConnection};
use sea_orm_migration::MigratorTrait;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

mod config;
mod entities;
mod error;
mod routes;
mod services;

use config::AppConfig;
use services::room_manager::{self, RoomManager};

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub config: Arc<AppConfig>,
    pub room_manager: RoomManager,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = AppConfig::from_env();
    tracing::info!("Starting SyncWatch backend on {}:{}", config.server_host, config.server_port);

    // Connect to database
    let db = Database::connect(&config.database_url).await?;
    tracing::info!("Connected to database");

    // Run migrations
    migration::Migrator::up(&db, None).await?;
    tracing::info!("Migrations applied");

    // Create video storage directory
    tokio::fs::create_dir_all(&config.video_storage_path).await?;

    let addr: SocketAddr = format!("{}:{}", config.server_host, config.server_port)
        .parse()
        .expect("Invalid server address");

    let state = AppState {
        db: db.clone(),
        config: Arc::new(config.clone()),
        room_manager: room_manager::new_room_manager(),
    };

    // Spawn room cleanup task
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        room_cleanup_task(cleanup_state).await;
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Auth
        .route("/api/auth/login", post(routes::auth::login))
        // Rooms
        .route("/api/rooms", post(routes::room::create_room))
        .route("/api/rooms/:room_id", get(routes::room::get_room))
        .route(
            "/api/rooms/:room_id/transfer",
            post(routes::room::transfer_owner),
        )
        // Video streaming
        .route("/api/stream/:video_id", get(routes::stream::stream_video))
        // WebSocket
        .route("/ws/room/:room_id", get(routes::ws::ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn room_cleanup_task(state: AppState) {
    use chrono::Utc;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

    let max_idle = chrono::Duration::hours(state.config.max_room_idle_hours as i64);

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;

        let cutoff = Utc::now() - max_idle;
        tracing::info!("Running room cleanup, removing rooms idle since {}", cutoff);

        // Find and delete old rooms
        let old_rooms = entities::room::Entity::find()
            .filter(entities::room::Column::LastActiveAt.lt(cutoff))
            .all(&state.db)
            .await;

        if let Ok(rooms) = old_rooms {
            for room in rooms {
                let room_id = room.id;
                // Remove from in-memory state
                state.room_manager.remove(&room_id);
                // Delete video files
                if let Ok(videos) = entities::video::Entity::find()
                    .filter(entities::video::Column::RoomId.eq(room_id))
                    .all(&state.db)
                    .await
                {
                    for video in videos {
                        if let Some(path) = &video.file_path {
                            let _ = tokio::fs::remove_file(path).await;
                        }
                    }
                }
                // Delete from DB (cascades to videos and messages)
                let _ = entities::room::Entity::delete_by_id(room_id)
                    .exec(&state.db)
                    .await;
                tracing::info!("Cleaned up room {}", room_id);
            }
        }
    }
}

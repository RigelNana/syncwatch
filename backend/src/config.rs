use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub server_host: String,
    pub server_port: u16,
    pub video_storage_path: String,
    pub max_room_idle_hours: u64,
    pub max_concurrent_downloads: usize,
    pub cookies_path: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            server_host: std::env::var("SERVER_HOST")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("SERVER_PORT must be a valid u16"),
            video_storage_path: std::env::var("VIDEO_STORAGE_PATH")
                .unwrap_or_else(|_| "./videos".to_string()),
            max_room_idle_hours: std::env::var("MAX_ROOM_IDLE_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()
                .unwrap_or(24),
            max_concurrent_downloads: std::env::var("MAX_CONCURRENT_DOWNLOADS")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
            cookies_path: std::env::var("COOKIES_PATH").ok().filter(|s| !s.is_empty()),
        }
    }
}

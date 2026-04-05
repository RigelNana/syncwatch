use axum::{extract::State, Json};
use chrono::Utc;
use jsonwebtoken::{encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use sea_orm::{ActiveModelTrait, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::AppState;

const AVATAR_COLORS: &[&str] = &[
    "#f87171", "#fb923c", "#fbbf24", "#a3e635",
    "#34d399", "#22d3ee", "#60a5fa", "#a78bfa",
    "#f472b6", "#e879f9",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub nickname: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub nickname: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub nickname: String,
    pub avatar_color: String,
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    let nickname = payload.nickname.trim();
    if nickname.is_empty() || nickname.len() > 32 {
        return Err(AppError::BadRequest("Nickname must be 1-32 characters".to_string()));
    }

    let user_id = Uuid::new_v4();
    let color_idx = rand::thread_rng().gen_range(0..AVATAR_COLORS.len());
    let avatar_color = AVATAR_COLORS[color_idx].to_string();

    let user = crate::entities::user::ActiveModel {
        id: Set(user_id),
        nickname: Set(nickname.to_string()),
        avatar_color: Set(avatar_color.clone()),
        created_at: Set(Utc::now().into()),
    };
    user.insert(&state.db).await?;

    let claims = Claims {
        sub: user_id,
        nickname: nickname.to_string(),
        exp: (Utc::now().timestamp() + 86400 * 7) as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    )?;

    Ok(Json(LoginResponse {
        token,
        user: UserInfo {
            id: user_id,
            nickname: nickname.to_string(),
            avatar_color,
        },
    }))
}

pub fn decode_token(token: &str, secret: &str) -> AppResult<Claims> {
    let token_data = jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

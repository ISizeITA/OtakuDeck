use tauri::{AppHandle, Emitter, State};

use crate::auth::AuthSession;
use crate::mal::suggestions::compute_suggestions;
use crate::mal::types::{
    AnimeListResponse, AnimeNode, AnimeSearchResponse, SearchAnimeParams, UpdateListStatusRequest,
    UserProfile,
};
use crate::mal::MalClient;
use crate::AppState;

async fn get_token(state: &State<'_, AppState>) -> Result<String, String> {
    let mut auth = state.auth.lock().await;
    auth.ensure_valid_token()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn complete_oauth_login(
    app: AppHandle,
    state: State<'_, AppState>,
    code: String,
    oauth_state: String,
) -> Result<(), String> {
    let mut auth = state.auth.lock().await;

    if let Err(err) = auth.complete_oauth(app.clone(), code, oauth_state).await {
        let message = err.to_string();
        let _ = app.emit("auth-error", &message);
        return Err(message);
    }

    Ok(())
}

#[tauri::command]
pub fn get_platform() -> &'static str {
    #[cfg(mobile)]
    {
        "mobile"
    }
    #[cfg(not(mobile))]
    {
        "desktop"
    }
}

#[tauri::command]
pub fn save_mal_client_id(client_id: String) -> Result<(), String> {
    crate::auth::save_client_id(&client_id)
}

#[tauri::command]
pub fn get_auth_config() -> serde_json::Value {
    serde_json::json!({
        "redirectUri": crate::auth::default_redirect_uri(),
        "desktopRedirectUri": crate::auth::DEFAULT_DESKTOP_REDIRECT,
        "mobileRedirectUri": crate::auth::DEFAULT_MOBILE_REDIRECT,
        "clientIdConfigured": crate::auth::is_mal_configured(),
    })
}

#[tauri::command]
pub async fn start_oauth_login(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut auth = state.auth.lock().await;

    if let Err(err) = auth.start_oauth(app.clone()).await {
        let message = err.to_string();
        let _ = app.emit("auth-error", &message);
        return Err(message);
    }

    Ok(())
}

#[tauri::command]
pub async fn get_auth_session(state: State<'_, AppState>) -> Result<Option<AuthSession>, String> {
    let auth = state.auth.lock().await;
    Ok(auth.get_session())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut auth = state.auth.lock().await;
    auth.logout().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_anime(
    state: State<'_, AppState>,
    params: SearchAnimeParams,
) -> Result<AnimeSearchResponse, String> {
    let token = get_token(&state).await?;
    MalClient::search_anime(&token, &params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_anime_details(
    state: State<'_, AppState>,
    id: u64,
) -> Result<AnimeNode, String> {
    let token = get_token(&state).await?;
    MalClient::get_anime_details(&token, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_anime_ranking(
    state: State<'_, AppState>,
    ranking_type: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<AnimeSearchResponse, String> {
    let token = get_token(&state).await?;
    MalClient::get_anime_ranking(
        &token,
        &ranking_type,
        limit.unwrap_or(12),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_seasonal_anime(
    state: State<'_, AppState>,
    year: u32,
    season: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<AnimeSearchResponse, String> {
    let token = get_token(&state).await?;
    MalClient::get_seasonal_anime(
        &token,
        year,
        &season,
        limit.unwrap_or(12),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_user_animelist(
    state: State<'_, AppState>,
    status: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<AnimeListResponse, String> {
    let token = get_token(&state).await?;
    MalClient::get_user_animelist(
        &token,
        status.as_deref(),
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_user_profile(state: State<'_, AppState>) -> Result<UserProfile, String> {
    let token = get_token(&state).await?;
    MalClient::get_user_profile(&token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_suggestions(state: State<'_, AppState>) -> Result<Vec<AnimeNode>, String> {
    let token = get_token(&state).await?;
    compute_suggestions(&token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_anime_list_status(
    state: State<'_, AppState>,
    anime_id: u64,
    status: Option<String>,
    score: Option<u8>,
    num_watched_episodes: Option<u32>,
    total_episodes: Option<u32>,
) -> Result<crate::mal::types::MyListStatus, String> {
    let token = get_token(&state).await?;

    let mut final_status = status;
    let mut final_episodes = num_watched_episodes;

    if let (Some(watched), Some(total)) = (num_watched_episodes, total_episodes) {
        if total > 0 && watched >= total {
            final_status = Some("completed".to_string());
            final_episodes = Some(total);
        }
    }

    let update = UpdateListStatusRequest {
        status: final_status,
        score,
        num_watched_episodes: final_episodes,
    };

    MalClient::update_list_status(&token, anime_id, &update)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_airing_anime(
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<AnimeSearchResponse, String> {
    let token = get_token(&state).await?;
    MalClient::get_anime_ranking(
        &token,
        "airing",
        limit.unwrap_or(24),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn translate_synopsis(
    anime_id: u64,
    text: String,
    target_lang: String,
) -> Result<String, String> {
    crate::translate::translate_synopsis(anime_id, &text, &target_lang).await
}

#[tauri::command]
pub fn get_translate_config() -> crate::translate::TranslateConfig {
    crate::translate::get_translate_config()
}

#[tauri::command]
pub fn save_translate_config(config: crate::translate::TranslateConfig) -> Result<(), String> {
    crate::translate::save_translate_config(&config)
}

#[tauri::command]
pub async fn check_translate_service() -> Result<Vec<String>, String> {
    let cfg = crate::translate::get_translate_config();
    crate::translate::check_service(&cfg).await
}

#[tauri::command]
pub fn get_mymemory_quota(mymemory_email: Option<String>) -> crate::translate::MyMemoryQuotaStatus {
    crate::translate::get_mymemory_quota_status(mymemory_email.as_deref())
}

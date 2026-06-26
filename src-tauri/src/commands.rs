use tauri::{AppHandle, Emitter, State};

use crate::auth::AuthSession;
use crate::mal::calendar::{build_airing_calendar, continue_watching_entries};
use crate::mal::home_feed::build_home_feed;
use crate::mal::suggestions::{compute_suggestions, compute_suggestions_from_list};
use crate::mal::types::{
    AiringCalendarEntry, AnimeListEntry, AnimeListResponse, AnimeNode, AnimeSearchResponse,
    AnimelistLoadProgress, ApiResponse, HomeFeed, SearchAnimeParams, UpdateListStatusRequest,
    UpdateUserProfileRequest, UserProfile,
};
use crate::mal::MalClient;
use crate::notifications::sync_episode_notifications;
use crate::preferences::{
    get_app_preferences as load_app_preferences, save_app_preferences as persist_app_preferences,
    AppPreferences,
};
use crate::AppState;

async fn get_token(state: &State<'_, AppState>) -> Result<String, String> {
    let mut auth = state.auth.lock().await;
    auth.ensure_valid_token()
        .await
        .map_err(|e| e.to_string())
}

const ANIMELIST_CACHE_TTL_SECS: i64 = 300;
const HOME_FEED_CACHE_TTL_SECS: i64 = 300;

fn cached_response<T>(
    cache: &crate::cache::DataCache,
    key: &str,
    ttl_secs: i64,
    data: T,
) -> ApiResponse<T> {
    ApiResponse {
        data,
        from_cache: true,
        cache_expires_at: cache.cache_expires_at(key, ttl_secs),
        cached_at: cache.cache_saved_at(key),
    }
}

fn fresh_response<T>(cache: &crate::cache::DataCache, key: &str, data: T) -> ApiResponse<T> {
    ApiResponse {
        data,
        from_cache: false,
        cache_expires_at: None,
        cached_at: cache.cache_saved_at(key),
    }
}

async fn with_cache<T, F, Fut>(
    state: &State<'_, AppState>,
    key: &str,
    ttl_secs: i64,
    fetch: F,
) -> Result<ApiResponse<T>, String>
where
    T: serde::Serialize + serde::de::DeserializeOwned + Clone,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    match fetch().await {
        Ok(data) => {
            let _ = state.cache.set(key, &data);
            Ok(fresh_response(&state.cache, key, data))
        }
        Err(err) => {
            if let Some(cached) = state.cache.get::<T>(key) {
                Ok(cached_response(&state.cache, key, ttl_secs, cached))
            } else {
                Err(err)
            }
        }
    }
}

async fn with_cache_ttl<T, F, Fut>(
    state: &State<'_, AppState>,
    key: &str,
    ttl_secs: i64,
    force_refresh: bool,
    fetch: F,
) -> Result<ApiResponse<T>, String>
where
    T: serde::Serialize + serde::de::DeserializeOwned + Clone,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    if !force_refresh {
        if let Some(cached) = state.cache.get_if_fresh::<T>(key, ttl_secs) {
            return Ok(cached_response(&state.cache, key, ttl_secs, cached));
        }
    }

    with_cache(state, key, ttl_secs, fetch).await
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
    let mut auth = state.auth.lock().await;
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
    let key = format!("anime_detail_{id}");
    if let Some(cached) = state
        .cache
        .get_if_fresh::<AnimeNode>(&key, HOME_FEED_CACHE_TTL_SECS)
    {
        return Ok(cached);
    }

    let token = get_token(&state).await?;
    match MalClient::get_anime_details(&token, id).await {
        Ok(detail) => {
            let _ = state.cache.set(&key, &detail);
            Ok(detail)
        }
        Err(err) => {
            if let Some(cached) = state.cache.get::<AnimeNode>(&key) {
                Ok(cached)
            } else {
                Err(err.to_string())
            }
        }
    }
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
    force_refresh: Option<bool>,
) -> Result<ApiResponse<AnimeSearchResponse>, String> {
    let limit = limit.unwrap_or(12);
    let offset = offset.unwrap_or(0);
    let key = format!("seasonal_{year}_{season}_{limit}_{offset}");
    with_cache_ttl(
        &state,
        &key,
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            MalClient::get_seasonal_anime(&token, year, &season, limit, offset)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await
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
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_user_animelist_all(
    app: AppHandle,
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<Vec<AnimeListEntry>>, String> {
    let force = force_refresh.unwrap_or(false);

    if !force {
        if let Some(cached) = state
            .cache
            .get_if_fresh::<Vec<AnimeListEntry>>("animelist_all", ANIMELIST_CACHE_TTL_SECS)
        {
            return Ok(cached_response(
                &state.cache,
                "animelist_all",
                ANIMELIST_CACHE_TTL_SECS,
                cached,
            ));
        }
    }

    let token = get_token(&state).await?;

    let total_hint = MalClient::get_user_profile(&token)
        .await
        .ok()
        .and_then(|p| p.anime_statistics.and_then(|s| s.num_items));

    let app_progress = app.clone();
    let fetch_result = MalClient::fetch_all_user_animelist_reporting(
        &token,
        total_hint,
        |loaded, total| {
            let _ = app_progress.emit(
                "animelist-load-progress",
                AnimelistLoadProgress {
                    loaded,
                    total,
                    done: false,
                },
            );
        },
    )
    .await;

    match fetch_result {
        Ok(data) => {
            let _ = state.cache.set("animelist_all", &data);
            let _ = app.emit(
                "animelist-load-progress",
                AnimelistLoadProgress {
                    loaded: data.len() as u32,
                    total: total_hint,
                    done: true,
                },
            );
            Ok(fresh_response(&state.cache, "animelist_all", data))
        }
        Err(err) => {
            if let Some(cached) = state.cache.get::<Vec<AnimeListEntry>>("animelist_all") {
                let _ = app.emit(
                    "animelist-load-progress",
                    AnimelistLoadProgress {
                        loaded: cached.len() as u32,
                        total: total_hint,
                        done: true,
                    },
                );
                Ok(cached_response(
                    &state.cache,
                    "animelist_all",
                    ANIMELIST_CACHE_TTL_SECS,
                    cached,
                ))
            } else {
                Err(err.to_string())
            }
        }
    }
}

fn invalidate_list_caches(state: &State<'_, AppState>) {
    let _ = state.cache.delete("animelist_all");
    let _ = state.cache.delete("continue_watching");
    let _ = state.cache.delete("suggestions");
    let _ = state.cache.delete("airing_calendar");
    let _ = state.cache.delete("home_feed");
}

#[tauri::command]
pub async fn get_user_profile(
    state: State<'_, AppState>,
) -> Result<ApiResponse<UserProfile>, String> {
    with_cache(&state, "user_profile", ANIMELIST_CACHE_TTL_SECS, || async {
        let token = get_token(&state).await?;
        MalClient::get_user_profile(&token)
            .await
            .map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn update_user_profile(
    state: State<'_, AppState>,
    update: UpdateUserProfileRequest,
) -> Result<UserProfile, String> {
    let token = get_token(&state).await?;
    let profile = MalClient::update_user_profile(&token, &update)
        .await
        .map_err(|e| e.to_string())?;
    let _ = state.cache.set("user_profile", &profile);
    Ok(profile)
}

#[tauri::command]
pub async fn get_suggestions(
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<Vec<AnimeNode>>, String> {
    with_cache_ttl(
        &state,
        "suggestions",
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            if let Some(list) = state.cache.get::<Vec<AnimeListEntry>>("animelist_all") {
                return compute_suggestions_from_list(&token, &list)
                    .await
                    .map_err(|e| e.to_string());
            }
            compute_suggestions(&token)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await
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

    let result = MalClient::update_list_status(&token, anime_id, &update)
        .await
        .map_err(|e| e.to_string())?;

    invalidate_list_caches(&state);

    Ok(result)
}

#[tauri::command]
pub async fn get_airing_calendar(
    app: AppHandle,
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<Vec<AiringCalendarEntry>>, String> {
    let response = with_cache_ttl(
        &state,
        "airing_calendar",
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            let list = state.cache.get::<Vec<AnimeListEntry>>("animelist_all");
            build_airing_calendar(&state.cache, &token, list)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await?;

    let prefs = load_app_preferences();
    let _ = sync_episode_notifications(&app, &prefs, &response.data);

    Ok(response)
}

#[tauri::command]
pub async fn get_home_feed(
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<HomeFeed>, String> {
    with_cache_ttl(
        &state,
        "home_feed",
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            let list = if let Some(cached) = state.cache.get::<Vec<AnimeListEntry>>("animelist_all")
            {
                cached
            } else {
                MalClient::fetch_all_user_animelist(&token)
                    .await
                    .map_err(|e| e.to_string())?
            };
            build_home_feed(&state.cache, &token, &list)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn get_continue_watching(
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<Vec<AnimeListEntry>>, String> {
    with_cache_ttl(
        &state,
        "continue_watching",
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            if let Some(list) = state.cache.get::<Vec<AnimeListEntry>>("animelist_all") {
                let watching: Vec<AnimeListEntry> = list
                    .into_iter()
                    .filter(|entry| {
                        entry
                            .list_status
                            .as_ref()
                            .and_then(|s| s.status.as_deref())
                            == Some("watching")
                    })
                    .collect();
                return Ok(continue_watching_entries(watching));
            }

            let token = get_token(&state).await?;
            let watching =
                MalClient::fetch_all_user_animelist_with_status(&token, Some("watching"))
                    .await
                    .map_err(|e| e.to_string())?;
            Ok(continue_watching_entries(watching))
        },
    )
    .await
}

#[tauri::command]
pub async fn get_airing_anime(
    state: State<'_, AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<AnimeSearchResponse>, String> {
    let limit = limit.unwrap_or(12);
    let offset = offset.unwrap_or(0);
    let key = format!("airing_{limit}_{offset}");
    with_cache_ttl(
        &state,
        &key,
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            MalClient::get_anime_ranking(&token, "airing", limit, offset)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub fn get_app_preferences() -> AppPreferences {
    load_app_preferences()
}

#[tauri::command]
pub fn save_app_preferences(prefs: AppPreferences) -> Result<(), String> {
    persist_app_preferences(&prefs)
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

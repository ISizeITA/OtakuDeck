use tauri::{AppHandle, Emitter, Manager, State};

use crate::accounts::MalAccountSummary;
use crate::auth::{AuthSession, OAuthStartOptions};
use crate::AppState;
use crate::mal::calendar::{airing_today, build_airing_calendar, continue_watching_entries};
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
use crate::cover_cache;
use crate::widget::sync_airing_widget;

async fn ensure_active_account(state: &State<'_, AppState>) -> Result<(), String> {
    let active_id = {
        let accounts = state.accounts.lock().await;
        accounts.active_account_id()
    };
    let Some(active_id) = active_id else {
        return Ok(());
    };

    let needs_switch = {
        let auth = state.auth.lock().await;
        auth.bound_account_id() != Some(active_id.as_str())
    };

    if needs_switch {
        switch_account_context(state, &active_id).await?;
    }
    Ok(())
}

async fn get_token(state: &State<'_, AppState>) -> Result<String, String> {
    ensure_active_account(state).await?;
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
            let cache = state.cache.lock().await;
            let _ = cache.set(key, &data);
            Ok(fresh_response(&cache, key, data))
        }
        Err(err) => {
            let cache = state.cache.lock().await;
            if let Some(cached) = cache.get::<T>(key) {
                Ok(cached_response(&cache, key, ttl_secs, cached))
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
        let cache = state.cache.lock().await;
        if let Some(cached) = cache.get_if_fresh::<T>(key, ttl_secs) {
            return Ok(cached_response(&cache, key, ttl_secs, cached));
        }
    }

    with_cache(state, key, ttl_secs, fetch).await
}

async fn switch_account_context(state: &State<'_, AppState>, account_id: &str) -> Result<(), String> {
    {
        let mut auth = state.auth.lock().await;
        auth.bind_account(account_id);
    }
    let cache_dir = {
        let accounts = state.accounts.lock().await;
        accounts.account_cache_dir(account_id)
    };
    {
        let mut cache = state.cache.lock().await;
        *cache = crate::cache::DataCache::new(cache_dir);
    }
    Ok(())
}

async fn finalize_oauth_login(
    app: &AppHandle,
    state: &State<'_, AppState>,
    oauth_opts: OAuthStartOptions,
) -> Result<String, String> {
    let session = {
        let mut auth = state.auth.lock().await;
        auth.get_session()
            .ok_or_else(|| "Sessione OAuth non disponibile.".to_string())?
    };

    let profile = MalClient::get_user_profile(&session.access_token)
        .await
        .map_err(|e| e.to_string())?;

    let account_id = {
        let mut accounts = state.accounts.lock().await;
        accounts.upsert_from_profile(
            &profile,
            oauth_opts.new_account,
            oauth_opts.account_id.as_deref(),
        )?
    };

    {
        let mut auth = state.auth.lock().await;
        auth.relocate_session_to_account(&account_id)
            .map_err(|e| e.to_string())?;
    }

    switch_account_context(state, &account_id).await?;

    let _ = app.emit("account-switched", &account_id);
    let _ = app.emit("auth-success", &session);

    Ok(account_id)
}

#[tauri::command]
pub async fn complete_oauth_login(
    app: AppHandle,
    state: State<'_, AppState>,
    code: String,
    oauth_state: String,
) -> Result<(), String> {
    {
        let mut auth = state.auth.lock().await;
        if let Err(err) = auth.complete_oauth(app.clone(), code, oauth_state).await {
            let message = err.to_string();
            let _ = app.emit("auth-error", &message);
            return Err(message);
        }
    }

    let oauth_opts = {
        let mut auth = state.auth.lock().await;
        auth.take_oauth_context()
    };

    finalize_oauth_login(&app, &state, oauth_opts).await?;
    Ok(())
}

#[tauri::command]
pub async fn list_mal_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<MalAccountSummary>, String> {
    let accounts = state.accounts.lock().await;
    Ok(accounts.list_summaries())
}

#[tauri::command]
pub async fn switch_mal_account(
    app: AppHandle,
    state: State<'_, AppState>,
    account_id: String,
) -> Result<(), String> {
    {
        let mut accounts = state.accounts.lock().await;
        accounts.set_active(&account_id)?;
    }

    switch_account_context(&state, &account_id).await?;

    let has_session = {
        let mut auth = state.auth.lock().await;
        auth.get_session().is_some()
    };

    if !has_session {
        return Err(
            "Sessione scaduta per questo account. Accedi di nuovo con MyAnimeList.".to_string(),
        );
    }

    let _ = app.emit("account-switched", &account_id);
    Ok(())
}

#[tauri::command]
pub async fn remove_mal_account(
    app: AppHandle,
    state: State<'_, AppState>,
    account_id: String,
) -> Result<(), String> {
    let next_active = {
        let mut accounts = state.accounts.lock().await;
        accounts.remove_account(&account_id)?
    };

    if let Some(next_id) = next_active {
        switch_account_context(&state, &next_id).await?;
        let _ = app.emit("account-switched", &next_id);
    } else {
        let mut auth = state.auth.lock().await;
        auth.use_legacy_session_path();
        auth.logout().map_err(|e| e.to_string())?;
        let fallback = {
            let accounts = state.accounts.lock().await;
            accounts.app_data_dir().join("cache")
        };
        let mut cache = state.cache.lock().await;
        *cache = crate::cache::DataCache::new(fallback);
        let _ = app.emit("account-switched", "");
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
    new_account: Option<bool>,
    account_id: Option<String>,
) -> Result<(), String> {
    let oauth_opts = OAuthStartOptions {
        new_account: new_account.unwrap_or(false),
        account_id: account_id.clone(),
    };

    {
        let mut auth = state.auth.lock().await;
        if let Err(err) = auth.start_oauth(app.clone(), oauth_opts.clone()).await {
            let message = err.to_string();
            let _ = app.emit("auth-error", &message);
            return Err(message);
        }
    }

    #[cfg(not(mobile))]
    {
        finalize_oauth_login(&app, &state, oauth_opts).await?;
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
    {
        let cache = state.cache.lock().await;
        if let Some(cached) = cache.get_if_fresh::<AnimeNode>(&key, HOME_FEED_CACHE_TTL_SECS) {
            return Ok(cached);
        }
    }

    let token = get_token(&state).await?;
    match MalClient::get_anime_details(&token, id).await {
        Ok(detail) => {
            let cache = state.cache.lock().await;
            let _ = cache.set(&key, &detail);
            Ok(detail)
        }
        Err(err) => {
            let cache = state.cache.lock().await;
            if let Some(cached) = cache.get::<AnimeNode>(&key) {
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
        let cache = state.cache.lock().await;
        if let Some(cached) =
            cache.get_if_fresh::<Vec<AnimeListEntry>>("animelist_all", ANIMELIST_CACHE_TTL_SECS)
        {
            return Ok(cached_response(
                &cache,
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
            let cache = state.cache.lock().await;
            let _ = cache.set("animelist_all", &data);
            let _ = app.emit(
                "animelist-load-progress",
                AnimelistLoadProgress {
                    loaded: data.len() as u32,
                    total: total_hint,
                    done: true,
                },
            );
            Ok(fresh_response(&cache, "animelist_all", data))
        }
        Err(err) => {
            let cache = state.cache.lock().await;
            if let Some(cached) = cache.get::<Vec<AnimeListEntry>>("animelist_all") {
                let _ = app.emit(
                    "animelist-load-progress",
                    AnimelistLoadProgress {
                        loaded: cached.len() as u32,
                        total: total_hint,
                        done: true,
                    },
                );
                Ok(cached_response(
                    &cache,
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

async fn invalidate_list_caches(state: &State<'_, AppState>, anime_id: Option<u64>) {
    let cache = state.cache.lock().await;
    let _ = cache.delete("animelist_all");
    let _ = cache.delete("continue_watching");
    let _ = cache.delete("suggestions");
    let _ = cache.delete("airing_calendar");
    let _ = cache.delete("home_feed");
    if let Some(id) = anime_id {
        let _ = cache.delete(&format!("anime_detail_{id}"));
    }
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
    let cache = state.cache.lock().await;
    let _ = cache.set("user_profile", &profile);
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
            let cached_list: Option<Vec<AnimeListEntry>> = {
                let cache = state.cache.lock().await;
                cache.get("animelist_all")
            };
            if let Some(list) = cached_list {
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

    if final_status.as_deref() == Some("completed") {
        if let Some(total) = total_episodes {
            if total > 0 {
                final_episodes = Some(total);
            }
        }
    }

    let update = UpdateListStatusRequest {
        status: final_status,
        score,
        num_watched_episodes: final_episodes,
    };

    if update.status.is_none()
        && update.score.is_none()
        && update.num_watched_episodes.is_none()
    {
        return Err(
            "Nessun dato da aggiornare. Seleziona uno stato o modifica episodi/voto.".to_string(),
        );
    }

    let result = MalClient::update_list_status(&token, anime_id, &update)
        .await
        .map_err(|e| e.to_string())?;

    invalidate_list_caches(&state, Some(anime_id)).await;

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
            let cache = state.cache.lock().await;
            let list = cache.get::<Vec<AnimeListEntry>>("animelist_all");
            build_airing_calendar(&cache, &token, list)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await?;

    let prefs = load_app_preferences();
    let _ = sync_episode_notifications(&app, &prefs, &response.data);
    sync_airing_widget(&app, &airing_today(&response.data));

    Ok(response)
}

#[tauri::command]
pub async fn get_home_feed(
    app: AppHandle,
    state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<ApiResponse<HomeFeed>, String> {
    let response = with_cache_ttl(
        &state,
        "home_feed",
        HOME_FEED_CACHE_TTL_SECS,
        force_refresh.unwrap_or(false),
        || async {
            let token = get_token(&state).await?;
            let list = {
                let cache = state.cache.lock().await;
                cache.get::<Vec<AnimeListEntry>>("animelist_all")
            };
            let list = if let Some(cached) = list {
                cached
            } else {
                MalClient::fetch_all_user_animelist(&token)
                    .await
                    .map_err(|e| e.to_string())?
            };
            let cache = state.cache.lock().await;
            build_home_feed(&cache, &token, &list)
                .await
                .map_err(|e| e.to_string())
        },
    )
    .await?;

    sync_airing_widget(&app, &response.data.airing_today);
    Ok(response)
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
            let cached_list = {
                let cache = state.cache.lock().await;
                cache.get::<Vec<AnimeListEntry>>("animelist_all")
            };
            if let Some(list) = cached_list {
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

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn check_for_updates(
    manifest_url: Option<String>,
) -> crate::updates::UpdateCheckResult {
    let url = manifest_url.unwrap_or_else(|| crate::updates::DEFAULT_MANIFEST_URL.to_string());
    let platform = if cfg!(mobile) { "mobile" } else { "desktop" };
    crate::updates::check_updates(&url, platform).await
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle, url: String) -> Result<(), String> {
    crate::updates::save_and_install_update(&app, &url).await
}

#[tauri::command]
pub async fn cache_anime_cover(
    app: AppHandle,
    anime_id: u64,
    url: String,
) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = cover_cache::ensure_cover_cached(&dir, anime_id, &url).await?;
    Ok(path.to_string_lossy().to_string())
}

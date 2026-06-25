use tokio::sync::Mutex;

pub mod auth;
pub mod commands;
pub mod mal;
pub mod translate;

use auth::AuthManager;

pub struct AppState {
    pub auth: Mutex<AuthManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_env();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(AppState {
            auth: Mutex::new(AuthManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_oauth_login,
            commands::complete_oauth_login,
            commands::get_platform,
            commands::get_auth_config,
            commands::save_mal_client_id,
            commands::get_auth_session,
            commands::logout,
            commands::search_anime,
            commands::get_anime_details,
            commands::get_anime_ranking,
            commands::get_seasonal_anime,
            commands::get_user_animelist,
            commands::get_user_profile,
            commands::get_suggestions,
            commands::update_anime_list_status,
            commands::get_airing_anime,
            commands::translate_synopsis,
            commands::get_translate_config,
            commands::save_translate_config,
            commands::check_translate_service,
            commands::get_mymemory_quota,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OtakuDeck");
}

fn load_env() {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest_dir.join("../.env"),
        manifest_dir.join(".env"),
    ];

    for path in &candidates {
        if path.exists() {
            let _ = dotenvy::from_path(path);
            return;
        }
    }

    let _ = dotenvy::dotenv();
}

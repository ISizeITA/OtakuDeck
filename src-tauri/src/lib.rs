use tokio::sync::Mutex;



pub mod auth;

pub mod cache;

pub mod commands;

pub mod mal;

pub mod notifications;

pub mod preferences;

pub mod translate;

pub mod cover_cache;

pub mod widget;

pub mod updates;



use auth::AuthManager;

use cache::DataCache;

use tauri::Manager;



pub struct AppState {

    pub auth: Mutex<AuthManager>,

    pub cache: DataCache,

}



#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

    load_env();



    tauri::Builder::default()

        .plugin(tauri_plugin_opener::init())

        .plugin(tauri_plugin_deep_link::init())

        .plugin(tauri_plugin_notification::init())

        .setup(|app| {

            if let Ok(dir) = app.path().app_data_dir() {

                auth::set_app_storage_dir(dir.clone());

                preferences::set_preferences_dir(dir.clone());

                let cache_dir = dir.join("cache");

                app.manage(AppState {

                    auth: Mutex::new(AuthManager::new()),

                    cache: DataCache::new(cache_dir),

                });

            } else {

                app.manage(AppState {

                    auth: Mutex::new(AuthManager::new()),

                    cache: DataCache::new(std::path::PathBuf::from("cache")),

                });

            }

            Ok(())

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
            commands::get_user_animelist_all,

            commands::get_user_profile,

            commands::update_user_profile,

            commands::get_suggestions,

            commands::update_anime_list_status,

            commands::get_airing_anime,

            commands::get_airing_calendar,

            commands::get_home_feed,

            commands::get_continue_watching,

            commands::get_app_preferences,

            commands::save_app_preferences,

            commands::translate_synopsis,

            commands::get_translate_config,

            commands::save_translate_config,

            commands::check_translate_service,

            commands::get_mymemory_quota,

            commands::get_app_version,

            commands::check_for_updates,

            commands::install_app_update,

            commands::cache_anime_cover,

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


use tokio::sync::Mutex;

use accounts::AccountStore;
use auth::AuthManager;
use cache::DataCache;
use tauri::Manager;

pub mod accounts;

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



pub struct AppState {
    pub accounts: Mutex<AccountStore>,
    pub auth: Mutex<AuthManager>,
    pub cache: Mutex<DataCache>,
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

                let store = AccountStore::load_or_migrate(dir.clone())
                    .unwrap_or_else(|e| {
                        eprintln!("AccountStore init failed: {e}");
                        AccountStore::load_or_migrate(dir.clone()).unwrap_or_else(|_| {
                            AccountStore::load_or_migrate(std::env::temp_dir()).expect("accounts")
                        })
                    });

                let mut auth = AuthManager::new();
                let cache_dir = if let Some(active_id) = store.active_account_id() {
                    auth.bind_account(&active_id);
                    store.account_cache_dir(&active_id)
                } else {
                    dir.join("cache")
                };

                app.manage(AppState {
                    accounts: Mutex::new(store),
                    auth: Mutex::new(auth),
                    cache: Mutex::new(DataCache::new(cache_dir)),
                });
            } else {
                app.manage(AppState {
                    accounts: Mutex::new(AccountStore::load_or_migrate(std::path::PathBuf::from(
                        "data",
                    ))
                    .expect("accounts")),
                    auth: Mutex::new(AuthManager::new()),
                    cache: Mutex::new(DataCache::new(std::path::PathBuf::from("cache"))),
                });
            }

            Ok(())
        })

        .invoke_handler(tauri::generate_handler![

            commands::start_oauth_login,

            commands::complete_oauth_login,

            commands::list_mal_accounts,

            commands::switch_mal_account,

            commands::remove_mal_account,

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


use std::fs;
use std::path::PathBuf;

use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};

static PREFS_PATH: OnceCell<PathBuf> = OnceCell::new();

pub fn set_preferences_dir(dir: PathBuf) {
    let _ = PREFS_PATH.set(dir);
}

fn prefs_path() -> PathBuf {
    PREFS_PATH
        .get()
        .cloned()
        .unwrap_or_else(|| dirs::data_local_dir().unwrap_or_default().join("OtakuDeck"))
        .join("app.preferences.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppPreferences {
    #[serde(default)]
    pub episode_notifications: bool,
    #[serde(default)]
    pub show_streaming_search_links: bool,
    #[serde(default = "default_reminder_minutes")]
    pub episode_reminder_minutes: u32,
}

fn default_reminder_minutes() -> u32 {
    30
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            episode_notifications: false,
            show_streaming_search_links: false,
            episode_reminder_minutes: 30,
        }
    }
}

pub fn get_app_preferences() -> AppPreferences {
    let path = prefs_path();
    if !path.exists() {
        return AppPreferences::default();
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save_app_preferences(prefs: &AppPreferences) -> Result<(), String> {
    let path = prefs_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

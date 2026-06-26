use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::mal::types::AiringCalendarEntry;

#[derive(Serialize)]
struct WidgetAnimeRow {
    anime_id: u64,
    title: String,
    time: Option<String>,
    episode: Option<u32>,
}

#[derive(Serialize)]
struct WidgetSnapshot {
    updated_at: String,
    entries: Vec<WidgetAnimeRow>,
}

pub fn sync_airing_widget(app: &AppHandle, entries: &[AiringCalendarEntry]) {
    let snapshot = WidgetSnapshot {
        updated_at: chrono::Utc::now().to_rfc3339(),
        entries: entries
            .iter()
            .map(|entry| WidgetAnimeRow {
                anime_id: entry.anime_id,
                title: entry.title.clone(),
                time: entry.broadcast_time.clone(),
                episode: entry.next_episode,
            })
            .collect(),
    };

    let Ok(json) = serde_json::to_string_pretty(&snapshot) else {
        return;
    };

    if let Ok(dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(&dir);
        let path = widget_file_path(&dir);
        let _ = fs::write(&path, json);
    }
}

pub fn widget_file_path(base: &Path) -> std::path::PathBuf {
    base.join("widget_airing.json")
}

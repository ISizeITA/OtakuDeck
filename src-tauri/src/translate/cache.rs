use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct TranslationCache {
    entries: HashMap<String, String>,
}

impl TranslationCache {
    pub fn load() -> Result<Self, String> {
        let path = cache_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }

    pub fn get(&self, anime_id: u64, target_lang: &str) -> Option<String> {
        self.entries.get(&cache_key(anime_id, target_lang)).cloned()
    }

    pub fn set(&mut self, anime_id: u64, target_lang: &str, text: &str) -> Result<(), String> {
        self.entries
            .insert(cache_key(anime_id, target_lang), text.to_string());
        self.persist()
    }

    fn persist(&self) -> Result<(), String> {
        let path = cache_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }
}

fn cache_key(anime_id: u64, target_lang: &str) -> String {
    format!("{anime_id}:{target_lang}")
}

fn cache_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("OtakuDeck")
        .join("translation-cache.json")
}

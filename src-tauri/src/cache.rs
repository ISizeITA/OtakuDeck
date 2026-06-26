use std::fs;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Serialize};

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct CacheEnvelope<T> {
    pub saved_at: DateTime<Utc>,
    pub data: T,
}

pub struct DataCache {
    dir: PathBuf,
}

impl DataCache {
    pub fn new(dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&dir);
        Self { dir }
    }

    fn path_for(&self, key: &str) -> PathBuf {
        let safe: String = key
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        self.dir.join(format!("{safe}.json"))
    }

    pub fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<(), String> {
        let envelope = CacheEnvelope {
            saved_at: Utc::now(),
            data: value,
        };
        let json = serde_json::to_string_pretty(&envelope).map_err(|e| e.to_string())?;
        fs::write(self.path_for(key), json).map_err(|e| e.to_string())
    }

    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.get_envelope(key).map(|e| e.data)
    }

    pub fn get_envelope<T: DeserializeOwned>(&self, key: &str) -> Option<CacheEnvelope<T>> {
        let path = self.path_for(key);
        let raw = fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    pub fn get_if_fresh<T: DeserializeOwned>(&self, key: &str, ttl_secs: i64) -> Option<T> {
        let envelope = self.get_envelope::<T>(key)?;
        let age = Utc::now()
            .signed_duration_since(envelope.saved_at)
            .num_seconds();
        if age <= ttl_secs {
            Some(envelope.data)
        } else {
            None
        }
    }

    pub fn cache_expires_at(&self, key: &str, ttl_secs: i64) -> Option<String> {
        let envelope = self.get_envelope::<serde_json::Value>(key)?;
        let expires = envelope.saved_at + chrono::Duration::seconds(ttl_secs);
        Some(expires.to_rfc3339())
    }

    pub fn cache_saved_at(&self, key: &str) -> Option<String> {
        self.get_envelope::<serde_json::Value>(key)
            .map(|e| e.saved_at.to_rfc3339())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        let path = self.path_for(key);
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_expires_at_after_set() {
        let dir = std::env::temp_dir().join(format!("otakudeck_cache_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let cache = DataCache::new(dir.clone());
        cache.set("test_key", &42i32).unwrap();

        let expires = cache.cache_expires_at("test_key", 300);
        assert!(expires.is_some());

        let saved = cache.cache_saved_at("test_key");
        assert!(saved.is_some());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn get_if_fresh_respects_ttl() {
        let dir = std::env::temp_dir().join(format!("otakudeck_cache_fresh_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let cache = DataCache::new(dir.clone());
        cache.set("fresh", &"hello".to_string()).unwrap();

        assert!(cache.get_if_fresh::<String>("fresh", 300).is_some());
        assert!(cache.get_if_fresh::<String>("fresh", -1).is_none());

        let _ = fs::remove_dir_all(&dir);
    }
}

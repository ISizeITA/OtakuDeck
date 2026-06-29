use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::mal::types::UserProfile;

pub const MAX_ACCOUNTS: usize = 5;
const ACCOUNTS_INDEX_FILE: &str = "accounts.json";
const ACCOUNTS_DIR: &str = "accounts";
const LEGACY_SESSION_FILE: &str = "session.json";
const LEGACY_CACHE_DIR: &str = "cache";
pub const SESSION_FILE: &str = "session.json";
pub const CACHE_DIR: &str = "cache";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MalAccountSummary {
    pub id: String,
    pub mal_user_id: u64,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub has_session: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccountRecord {
    id: String,
    mal_user_id: u64,
    display_name: String,
    avatar_url: Option<String>,
    added_at: String,
    last_used_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AccountsIndex {
    accounts: Vec<AccountRecord>,
    active_account_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AccountStore {
    app_data_dir: PathBuf,
    index: AccountsIndex,
}

impl AccountStore {
    pub fn load_or_migrate(app_data_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let index_path = app_data_dir.join(ACCOUNTS_INDEX_FILE);

        if index_path.exists() {
            let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
            let index: AccountsIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            return Ok(Self {
                app_data_dir,
                index,
            });
        }

        let mut store = Self {
            app_data_dir: app_data_dir.clone(),
            index: AccountsIndex::default(),
        };

        let legacy_session = app_data_dir.join(LEGACY_SESSION_FILE);
        if legacy_session.exists() {
            store.migrate_legacy_session(&legacy_session)?;
        }

        if !store.index.accounts.is_empty() {
            store.persist()?;
        }

        Ok(store)
    }

    fn migrate_legacy_session(&mut self, legacy_session: &Path) -> Result<(), String> {
        let account_id = new_account_id();
        let account_dir = self.account_dir(&account_id);
        fs::create_dir_all(&account_dir).map_err(|e| e.to_string())?;

        let target_session = account_dir.join(SESSION_FILE);
        fs::rename(legacy_session, &target_session).map_err(|e| e.to_string())?;

        let legacy_cache = self.app_data_dir.join(LEGACY_CACHE_DIR);
        if legacy_cache.exists() {
            let target_cache = account_dir.join(CACHE_DIR);
            if target_cache.exists() {
                merge_dir(&legacy_cache, &target_cache)?;
                let _ = fs::remove_dir_all(&legacy_cache);
            } else {
                fs::rename(&legacy_cache, &target_cache).map_err(|e| e.to_string())?;
            }
        }

        let now = Utc::now().to_rfc3339();
        self.index.accounts.push(AccountRecord {
            id: account_id.clone(),
            mal_user_id: 0,
            display_name: "MyAnimeList".to_string(),
            avatar_url: None,
            added_at: now.clone(),
            last_used_at: now,
        });
        self.index.active_account_id = Some(account_id);
        Ok(())
    }

    pub fn app_data_dir(&self) -> &Path {
        &self.app_data_dir
    }

    pub fn account_dir(&self, account_id: &str) -> PathBuf {
        self.app_data_dir.join(ACCOUNTS_DIR).join(account_id)
    }

    pub fn account_cache_dir(&self, account_id: &str) -> PathBuf {
        self.account_dir(account_id).join(CACHE_DIR)
    }

    pub fn account_session_path(&self, account_id: &str) -> PathBuf {
        self.account_dir(account_id).join(SESSION_FILE)
    }

    pub fn active_account_id(&self) -> Option<String> {
        self.index.active_account_id.clone()
    }

    pub fn list_summaries(&self) -> Vec<MalAccountSummary> {
        let active = self.index.active_account_id.as_deref();
        self.index
            .accounts
            .iter()
            .map(|record| MalAccountSummary {
                id: record.id.clone(),
                mal_user_id: record.mal_user_id,
                display_name: record.display_name.clone(),
                avatar_url: record.avatar_url.clone(),
                is_active: active == Some(record.id.as_str()),
                has_session: self.account_session_path(&record.id).exists(),
            })
            .collect()
    }

    pub fn set_active(&mut self, account_id: &str) -> Result<(), String> {
        if !self.index.accounts.iter().any(|a| a.id == account_id) {
            return Err("Account non trovato.".to_string());
        }
        self.index.active_account_id = Some(account_id.to_string());
        if let Some(record) = self
            .index
            .accounts
            .iter_mut()
            .find(|a| a.id == account_id)
        {
            record.last_used_at = Utc::now().to_rfc3339();
        }
        self.persist()
    }

    pub fn upsert_from_profile(
        &mut self,
        profile: &UserProfile,
        new_account: bool,
        target_account_id: Option<&str>,
    ) -> Result<String, String> {
        let now = Utc::now().to_rfc3339();

        if let Some(target_id) = target_account_id {
            let record = self
                .index
                .accounts
                .iter_mut()
                .find(|a| a.id == target_id)
                .ok_or_else(|| "Account non trovato.".to_string())?;
            record.mal_user_id = profile.id;
            record.display_name = profile.name.clone();
            record.avatar_url = profile.picture.clone();
            record.last_used_at = now.clone();
            self.index.active_account_id = Some(target_id.to_string());
            self.persist()?;
            return Ok(target_id.to_string());
        }

        if !new_account {
            if let Some(existing) = self
                .index
                .accounts
                .iter_mut()
                .find(|a| a.mal_user_id == profile.id && a.mal_user_id != 0)
            {
                existing.display_name = profile.name.clone();
                existing.avatar_url = profile.picture.clone();
                existing.last_used_at = now.clone();
                let id = existing.id.clone();
                self.index.active_account_id = Some(id.clone());
                self.persist()?;
                return Ok(id);
            }
        } else if let Some(existing) = self
            .index
            .accounts
            .iter_mut()
            .find(|a| a.mal_user_id == profile.id && a.mal_user_id != 0)
        {
            existing.display_name = profile.name.clone();
            existing.avatar_url = profile.picture.clone();
            existing.last_used_at = now.clone();
            let id = existing.id.clone();
            self.index.active_account_id = Some(id.clone());
            self.persist()?;
            return Ok(id);
        }

        if self.index.accounts.len() >= MAX_ACCOUNTS {
            return Err(format!(
                "Limite di {MAX_ACCOUNTS} account raggiunto. Rimuovi un account prima di aggiungerne uno nuovo."
            ));
        }

        let account_id = new_account_id();
        fs::create_dir_all(self.account_dir(&account_id)).map_err(|e| e.to_string())?;
        self.index.accounts.push(AccountRecord {
            id: account_id.clone(),
            mal_user_id: profile.id,
            display_name: profile.name.clone(),
            avatar_url: profile.picture.clone(),
            added_at: now.clone(),
            last_used_at: now,
        });
        self.index.active_account_id = Some(account_id.clone());
        self.persist()?;
        Ok(account_id)
    }

    pub fn remove_account(&mut self, account_id: &str) -> Result<Option<String>, String> {
        let pos = self
            .index
            .accounts
            .iter()
            .position(|a| a.id == account_id)
            .ok_or_else(|| "Account non trovato.".to_string())?;
        self.index.accounts.remove(pos);

        let account_dir = self.account_dir(account_id);
        if account_dir.exists() {
            fs::remove_dir_all(&account_dir).map_err(|e| e.to_string())?;
        }

        let was_active = self.index.active_account_id.as_deref() == Some(account_id);
        let next_active = if was_active {
            self.index
                .accounts
                .iter()
                .max_by_key(|a| a.last_used_at.clone())
                .map(|a| a.id.clone())
        } else {
            self.index.active_account_id.clone()
        };
        self.index.active_account_id = next_active.clone();
        self.persist()?;
        Ok(next_active)
    }

    pub fn persist(&self) -> Result<(), String> {
        let path = self.app_data_dir.join(ACCOUNTS_INDEX_FILE);
        let json = serde_json::to_string_pretty(&self.index).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }
}

pub fn new_account_id() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..16)
        .map(|_| format!("{:02x}", rng.gen::<u8>()))
        .collect()
}

fn merge_dir(from: &Path, into: &Path) -> Result<(), String> {
    fs::create_dir_all(into).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let dest = into.join(entry.file_name());
        if file_type.is_dir() {
            merge_dir(&entry.path(), &dest)?;
        } else if !dest.exists() {
            fs::rename(entry.path(), dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_app_data() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("otakudeck_accounts_test_{nanos}"))
    }

    #[test]
    fn migrates_legacy_session_and_cache() {
        let dir = temp_app_data();
        let _ = fs::remove_dir_all(&dir);

        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(LEGACY_SESSION_FILE), r#"{"access_token":"x","refresh_token":"y","expires_in":3600,"token_type":"Bearer","obtained_at":1}"#).unwrap();
        fs::create_dir_all(dir.join(LEGACY_CACHE_DIR)).unwrap();
        fs::write(dir.join(LEGACY_CACHE_DIR).join("animelist_all.json"), "{}").unwrap();

        let store = AccountStore::load_or_migrate(dir.clone()).unwrap();
        assert_eq!(store.index.accounts.len(), 1);
        let id = store.active_account_id().unwrap();
        assert!(store.account_session_path(&id).exists());
        assert!(store.account_cache_dir(&id).join("animelist_all.json").exists());
        assert!(!dir.join(LEGACY_SESSION_FILE).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn upsert_respects_max_accounts() {
        let dir = temp_app_data();
        let _ = fs::remove_dir_all(&dir);

        let mut store = AccountStore::load_or_migrate(dir.clone()).unwrap();
        for i in 0..MAX_ACCOUNTS {
            let profile = UserProfile {
                id: 1000 + i as u64,
                name: format!("User{i}"),
                picture: None,
                gender: None,
                location: None,
                birthday: None,
                time_zone: None,
                about: None,
                anime_statistics: None,
            };
            store.upsert_from_profile(&profile, true, None).unwrap();
        }

        let overflow = UserProfile {
            id: 9999,
            name: "Overflow".to_string(),
            picture: None,
            gender: None,
            location: None,
            birthday: None,
            time_zone: None,
            about: None,
            anime_statistics: None,
        };
        assert!(store.upsert_from_profile(&overflow, true, None).is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn remove_account_switches_active() {
        let dir = temp_app_data();
        let _ = fs::remove_dir_all(&dir);

        let mut store = AccountStore::load_or_migrate(dir.clone()).unwrap();
        let p1 = UserProfile {
            id: 1,
            name: "A".to_string(),
            picture: None,
            gender: None,
            location: None,
            birthday: None,
            time_zone: None,
            about: None,
            anime_statistics: None,
        };
        let p2 = UserProfile {
            id: 2,
            name: "B".to_string(),
            picture: None,
            gender: None,
            location: None,
            birthday: None,
            time_zone: None,
            about: None,
            anime_statistics: None,
        };
        let id1 = store.upsert_from_profile(&p1, true, None).unwrap();
        let id2 = store.upsert_from_profile(&p2, true, None).unwrap();
        store.set_active(&id1).unwrap();

        let next = store.remove_account(&id1).unwrap();
        assert_eq!(next, Some(id2.clone()));
        assert_eq!(store.active_account_id(), Some(id2));

        let _ = fs::remove_dir_all(&dir);
    }
}

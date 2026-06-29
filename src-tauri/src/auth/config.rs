use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOAuth {
    pub code_verifier: String,
    pub state: String,
    pub redirect_uri: String,
    #[serde(default)]
    pub new_account: bool,
    #[serde(default)]
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct OAuthStartOptions {
    pub new_account: bool,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MalConfigFile {
    #[serde(alias = "clientId")]
    client_id: String,
}

pub const DEFAULT_DESKTOP_REDIRECT: &str = "http://127.0.0.1:14568/callback";
pub const DEFAULT_MOBILE_REDIRECT: &str = "otakudeck://callback";

pub fn default_redirect_uri() -> String {
    std::env::var("VITE_MAL_REDIRECT_URI")
        .or_else(|_| std::env::var("MAL_REDIRECT_URI"))
        .unwrap_or_else(|_| {
            #[cfg(mobile)]
            {
                DEFAULT_MOBILE_REDIRECT.to_string()
            }
            #[cfg(not(mobile))]
            {
                DEFAULT_DESKTOP_REDIRECT.to_string()
            }
        })
}

fn validate_client_id(id: &str) -> Result<String, String> {
    let trimmed = id.trim().to_string();
    if trimmed.is_empty()
        || trimmed == "your_client_id_here"
        || trimmed.eq_ignore_ascii_case("incolla_il_tuo_client_id_qui")
        || trimmed.starts_with("INCOLLA_QUI")
    {
        Err("Client ID MAL non configurato.".to_string())
    } else {
        Ok(trimmed)
    }
}

fn project_mal_config_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../mal.config.json")
}

fn app_mal_config_path() -> PathBuf {
    super::storage::app_storage_dir().join("mal.config.json")
}

fn read_client_id_from_file(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    let cfg: MalConfigFile = serde_json::from_str(&content).ok()?;
    validate_client_id(&cfg.client_id).ok()
}

pub fn mal_client_id() -> Result<String, String> {
    if let Ok(id) = std::env::var("VITE_MAL_CLIENT_ID") {
        if let Ok(v) = validate_client_id(&id) {
            return Ok(v);
        }
    }
    if let Ok(id) = std::env::var("MAL_CLIENT_ID") {
        if let Ok(v) = validate_client_id(&id) {
            return Ok(v);
        }
    }

    if let Some(id) = option_env!("BUNDLED_MAL_CLIENT_ID").filter(|s| !s.is_empty()) {
        if let Ok(v) = validate_client_id(id) {
            return Ok(v);
        }
    }

    if let Some(id) = read_client_id_from_file(&project_mal_config_path()) {
        return Ok(id);
    }

    if let Some(id) = read_client_id_from_file(&app_mal_config_path()) {
        return Ok(id);
    }

    Err("Client ID MAL non configurato.".to_string())
}

pub fn is_mal_configured() -> bool {
    mal_client_id().is_ok()
}

pub fn save_client_id(client_id: &str) -> Result<(), String> {
    let validated = validate_client_id(client_id)?;
    let path = app_mal_config_path();

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let cfg = MalConfigFile {
        client_id: validated,
    };
    let json = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

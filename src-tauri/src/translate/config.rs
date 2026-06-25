use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const PROVIDER_MYMEMORY: &str = "mymemory";
pub const PROVIDER_DEEPL: &str = "deepl";
pub const PROVIDER_GOOGLE: &str = "google";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateConfig {
    #[serde(default = "default_provider")]
    pub provider: String,
    #[serde(default, alias = "apiKey")]
    pub api_key: Option<String>,
    #[serde(default, alias = "apiUrl")]
    pub api_url: Option<String>,
    #[serde(default, alias = "mymemoryEmail")]
    pub mymemory_email: Option<String>,
}

fn default_provider() -> String {
    PROVIDER_MYMEMORY.to_string()
}

impl Default for TranslateConfig {
    fn default() -> Self {
        Self {
            provider: default_provider(),
            api_key: None,
            api_url: None,
            mymemory_email: None,
        }
    }
}

fn project_config_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../translate.config.json")
}

fn app_config_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("OtakuDeck")
        .join("translate.config.json")
}

fn normalize_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn normalize_provider(provider: &str) -> String {
    match provider.trim().to_lowercase().as_str() {
        PROVIDER_DEEPL => PROVIDER_DEEPL.to_string(),
        PROVIDER_GOOGLE => PROVIDER_GOOGLE.to_string(),
        _ => PROVIDER_MYMEMORY.to_string(),
    }
}

fn read_config_from_file(path: &Path) -> Option<TranslateConfig> {
    let content = std::fs::read_to_string(path).ok()?;
    let mut cfg: TranslateConfig = serde_json::from_str(&content).ok()?;
    cfg.provider = normalize_provider(&cfg.provider);
    if let Some(url) = cfg.api_url.as_mut() {
        *url = normalize_url(url);
    }
    Some(cfg)
}

pub fn get_translate_config() -> TranslateConfig {
    if let Some(cfg) = read_config_from_file(&app_config_path()) {
        return cfg;
    }
    if let Some(cfg) = read_config_from_file(&project_config_path()) {
        return cfg;
    }
    TranslateConfig::default()
}

pub fn save_translate_config(cfg: &TranslateConfig) -> Result<(), String> {
    let provider = normalize_provider(&cfg.provider);

    if provider == PROVIDER_DEEPL || provider == PROVIDER_GOOGLE {
        let key = cfg
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|k| !k.is_empty())
            .ok_or_else(|| "API key is required for the selected provider.".to_string())?;
        if key.len() < 8 {
            return Err("API key looks too short.".to_string());
        }
    }

    if let Some(url) = cfg.api_url.as_deref().map(normalize_url).filter(|u| !u.is_empty()) {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("API URL must start with http:// or https://".to_string());
        }
    }

    let normalized = TranslateConfig {
        provider,
        api_key: cfg
            .api_key
            .as_ref()
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty()),
        api_url: cfg
            .api_url
            .as_ref()
            .map(|u| normalize_url(u))
            .filter(|u| !u.is_empty()),
        mymemory_email: cfg
            .mymemory_email
            .as_ref()
            .map(|e| e.trim().to_string())
            .filter(|e| !e.is_empty()),
    };

    let path = app_config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&normalized).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

pub async fn check_service(cfg: &TranslateConfig) -> Result<Vec<String>, String> {
    match cfg.provider.as_str() {
        PROVIDER_DEEPL => {
            let client = super::DeepLClient::new(
                cfg.api_key.as_deref().unwrap_or(""),
                cfg.api_url.as_deref(),
            )
            .map_err(|e| e.to_string())?;
            client.check().await.map_err(|e| e.to_string())?;
            Ok(vec!["en".to_string(), "it".to_string()])
        }
        PROVIDER_GOOGLE => {
            let client = super::GoogleTranslateClient::new(
                cfg.api_key.as_deref().unwrap_or(""),
                cfg.api_url.as_deref(),
            )
            .map_err(|e| e.to_string())?;
            client.check().await.map_err(|e| e.to_string())?;
            Ok(vec!["en".to_string(), "it".to_string()])
        }
        _ => {
            let client = super::MyMemoryClient::new(cfg.mymemory_email.as_deref());
            client.check().await.map_err(|e| e.to_string())?;
            Ok(vec!["en".to_string(), "it".to_string()])
        }
    }
}

pub async fn translate_with_config(
    cfg: &TranslateConfig,
    text: &str,
    source: &str,
    target: &str,
) -> Result<String, String> {
    match cfg.provider.as_str() {
        PROVIDER_DEEPL => {
            let client = super::DeepLClient::new(
                cfg.api_key.as_deref().unwrap_or(""),
                cfg.api_url.as_deref(),
            )
            .map_err(|e| e.to_string())?;
            client
                .translate(text, source, target)
                .await
                .map_err(|e| e.to_string())
        }
        PROVIDER_GOOGLE => {
            let client = super::GoogleTranslateClient::new(
                cfg.api_key.as_deref().unwrap_or(""),
                cfg.api_url.as_deref(),
            )
            .map_err(|e| e.to_string())?;
            client
                .translate(text, source, target)
                .await
                .map_err(|e| e.to_string())
        }
        _ => {
            let client = super::MyMemoryClient::new(cfg.mymemory_email.as_deref());
            client
                .translate(text, source, target)
                .await
                .map_err(|e| e.to_string())
        }
    }
}

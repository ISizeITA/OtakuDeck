mod cache;
mod config;
mod deepl;
mod google;
mod mymemory;
mod quota;
mod split;

pub use cache::TranslationCache;
pub use config::{
    check_service, get_translate_config, save_translate_config, TranslateConfig, PROVIDER_DEEPL,
    PROVIDER_GOOGLE, PROVIDER_MYMEMORY,
};
pub use deepl::DeepLClient;
pub use google::GoogleTranslateClient;
pub use mymemory::MyMemoryClient;
pub use quota::MyMemoryQuotaStatus;

use std::sync::Mutex;

use once_cell::sync::Lazy;

static CACHE: Lazy<Mutex<TranslationCache>> =
    Lazy::new(|| Mutex::new(TranslationCache::load().unwrap_or_default()));

pub async fn translate_synopsis(
    anime_id: u64,
    text: &str,
    target_lang: &str,
) -> Result<String, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Empty synopsis.".to_string());
    }

    let target = normalize_lang(target_lang);
    if target == "en" {
        return Ok(trimmed.to_string());
    }

    if let Some(cached) = CACHE
        .lock()
        .map_err(|e| e.to_string())?
        .get(anime_id, &target)
    {
        return Ok(cached);
    }

    let cfg = get_translate_config();

    if cfg.provider == PROVIDER_MYMEMORY {
        let characters = quota::count_characters(trimmed);
        let status = quota::get_status(cfg.mymemory_email.as_deref());
        if characters > status.characters_remaining {
            return Err("QUOTA_INSUFFICIENT".to_string());
        }
    }

    let translated = match config::translate_with_config(&cfg, trimmed, "en", &target).await {
        Ok(text) => text,
        Err(err) => {
            if cfg.provider == PROVIDER_MYMEMORY
                && err.to_lowercase().contains("quota")
            {
                let _ = quota::mark_exhausted(cfg.mymemory_email.as_deref());
            }
            return Err(err);
        }
    };

    if cfg.provider == PROVIDER_MYMEMORY {
        let characters = quota::count_characters(trimmed);
        if characters > 0 {
            let _ = quota::record_usage(characters, cfg.mymemory_email.as_deref());
        }
    }

    CACHE
        .lock()
        .map_err(|e| e.to_string())?
        .set(anime_id, &target, &translated)
        .map_err(|e| e.to_string())?;

    Ok(translated)
}

fn normalize_lang(lang: &str) -> String {
    lang.trim().to_lowercase().chars().take(2).collect()
}

pub fn get_mymemory_quota_status(mymemory_email: Option<&str>) -> MyMemoryQuotaStatus {
    let cfg = get_translate_config();
    let email = mymemory_email
        .filter(|e| !e.trim().is_empty())
        .or(cfg.mymemory_email.as_deref());
    quota::get_status(email)
}

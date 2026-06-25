use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// MyMemory daily limits (characters, per official documentation).
pub const LIMIT_ANONYMOUS: u32 = 5_000;
pub const LIMIT_WITH_EMAIL: u32 = 50_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MyMemoryQuotaStatus {
    pub characters_used: u32,
    pub characters_limit: u32,
    pub characters_remaining: u32,
    pub percent_used: f64,
    pub percent_remaining: f64,
    pub has_email: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct QuotaState {
    date: String,
    #[serde(alias = "charactersUsed", alias = "words_used", alias = "wordsUsed")]
    characters_used: u32,
}

pub fn count_characters(text: &str) -> u32 {
    text.chars().count() as u32
}

pub fn character_limit(has_email: bool) -> u32 {
    if has_email {
        LIMIT_WITH_EMAIL
    } else {
        LIMIT_ANONYMOUS
    }
}

pub fn get_status(email: Option<&str>) -> MyMemoryQuotaStatus {
    let has_email = email.map(|e| !e.trim().is_empty()).unwrap_or(false);
    let limit = character_limit(has_email);
    let used = load_state().characters_used.min(limit);
    build_status(used, limit, has_email)
}

pub fn record_usage(characters: u32, email: Option<&str>) -> Result<MyMemoryQuotaStatus, String> {
    let has_email = email.map(|e| !e.trim().is_empty()).unwrap_or(false);
    let limit = character_limit(has_email);
    let mut state = load_state();
    state.characters_used = state.characters_used.saturating_add(characters).min(limit);
    persist(&state)?;
    Ok(build_status(state.characters_used, limit, has_email))
}

pub fn mark_exhausted(email: Option<&str>) -> Result<MyMemoryQuotaStatus, String> {
    let has_email = email.map(|e| !e.trim().is_empty()).unwrap_or(false);
    let limit = character_limit(has_email);
    let mut state = load_state();
    state.characters_used = limit;
    persist(&state)?;
    Ok(build_status(state.characters_used, limit, has_email))
}

fn build_status(used: u32, limit: u32, has_email: bool) -> MyMemoryQuotaStatus {
    let used = used.min(limit);
    let remaining = limit.saturating_sub(used);

    let percent_used = if limit == 0 {
        0.0
    } else {
        round_percent((used as f64 / limit as f64) * 100.0)
    };
    let percent_remaining = if limit == 0 {
        0.0
    } else {
        round_percent((remaining as f64 / limit as f64) * 100.0)
    };

    MyMemoryQuotaStatus {
        characters_used: used,
        characters_limit: limit,
        characters_remaining: remaining,
        percent_used,
        percent_remaining,
        has_email,
    }
}

fn round_percent(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn load_state() -> QuotaState {
    let path = quota_path();
    if !path.exists() {
        return QuotaState {
            date: today(),
            characters_used: 0,
        };
    }

    let content = fs::read_to_string(&path).unwrap_or_default();
    let mut state: QuotaState = serde_json::from_str(&content).unwrap_or_default();
    if state.date != today() {
        state = QuotaState {
            date: today(),
            characters_used: 0,
        };
        let _ = persist(&state);
    }
    state
}

fn persist(state: &QuotaState) -> Result<(), String> {
    let path = quota_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn quota_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("OtakuDeck")
        .join("mymemory-quota.json")
}

#[cfg(test)]
mod tests {
    use super::{build_status, character_limit, count_characters, round_percent, LIMIT_ANONYMOUS};

    #[test]
    fn counts_unicode_characters() {
        assert_eq!(count_characters("hello"), 5);
        assert_eq!(count_characters("città"), 5);
    }

    #[test]
    fn percent_at_half_quota() {
        let status = build_status(LIMIT_ANONYMOUS / 2, LIMIT_ANONYMOUS, false);
        assert_eq!(status.percent_used, 50.0);
        assert_eq!(status.percent_remaining, 50.0);
    }

    #[test]
    fn percent_small_usage_has_precision() {
        let status = build_status(25, LIMIT_ANONYMOUS, false);
        assert_eq!(status.percent_used, 0.5);
        assert_eq!(status.percent_remaining, 99.5);
    }

    #[test]
    fn round_percent_one_decimal() {
        assert_eq!(round_percent(12.34), 12.3);
        assert_eq!(round_percent(12.35), 12.4);
    }

    #[test]
    fn email_doubles_limit_order_of_magnitude() {
        assert_eq!(character_limit(false), 5_000);
        assert_eq!(character_limit(true), 50_000);
    }
}

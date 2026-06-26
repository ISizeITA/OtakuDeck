use serde::{Deserialize, Serialize};

pub const DEFAULT_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/ISizeITA/OtakuDeck/main/updates/manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateManifest {
    pub version: String,
    #[serde(default)]
    pub released_at: Option<String>,
    #[serde(default)]
    pub release_url: Option<String>,
    #[serde(default)]
    pub changelog: Vec<String>,
    #[serde(default)]
    pub platforms: UpdatePlatforms,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdatePlatforms {
    #[serde(default)]
    pub windows: Option<PlatformRelease>,
    #[serde(default)]
    pub android: Option<PlatformRelease>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformRelease {
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub changelog: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn check_updates(manifest_url: &str, platform: &str) -> UpdateCheckResult {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(err) => {
            return error_result(&current_version, err.to_string());
        }
    };

    let response = match client.get(manifest_url).send().await {
        Ok(resp) => resp,
        Err(err) => {
            return error_result(&current_version, err.to_string());
        }
    };

    if !response.status().is_success() {
        return error_result(
            &current_version,
            format!("Manifest HTTP {}", response.status()),
        );
    }

    let manifest: UpdateManifest = match response.json().await {
        Ok(m) => m,
        Err(err) => {
            return error_result(&current_version, err.to_string());
        }
    };

    let latest_version = manifest.version.trim().trim_start_matches('v').to_string();
    let update_available = is_version_newer(&latest_version, &current_version);
    let download_url = platform_download_url(&manifest, platform);

    UpdateCheckResult {
        current_version,
        latest_version,
        update_available,
        download_url,
        release_url: manifest.release_url,
        changelog: manifest.changelog,
        error: None,
    }
}

fn error_result(current_version: &str, message: String) -> UpdateCheckResult {
    UpdateCheckResult {
        current_version: current_version.to_string(),
        latest_version: current_version.to_string(),
        update_available: false,
        download_url: None,
        release_url: None,
        changelog: Vec::new(),
        error: Some(message),
    }
}

fn platform_download_url(manifest: &UpdateManifest, platform: &str) -> Option<String> {
    match platform {
        "mobile" => manifest
            .platforms
            .android
            .as_ref()
            .map(|p| p.download_url.clone()),
        _ => manifest
            .platforms
            .windows
            .as_ref()
            .map(|p| p.download_url.clone()),
    }
}

pub fn parse_version(version: &str) -> Option<(u32, u32, u32)> {
    let normalized = version.trim().trim_start_matches('v');
    let mut parts = normalized.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

pub fn is_version_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_patch_version() {
        assert!(is_version_newer("0.1.2", "0.1.1"));
        assert!(!is_version_newer("0.1.1", "0.1.1"));
        assert!(!is_version_newer("0.1.0", "0.1.1"));
    }

    #[test]
    fn newer_minor_version() {
        assert!(is_version_newer("0.2.0", "0.1.9"));
    }

    #[test]
    fn strips_v_prefix() {
        assert!(is_version_newer("v0.1.2", "0.1.1"));
    }

    #[test]
    fn manifest_deserializes_changelog() {
        let raw = r#"{"version":"0.1.2","changelog":["Line one"],"platforms":{}}"#;
        let manifest: UpdateManifest = serde_json::from_str(raw).unwrap();
        assert_eq!(manifest.changelog.len(), 1);
    }
}

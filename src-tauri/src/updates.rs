use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::Manager;

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

pub fn filename_from_url(url: &str) -> String {
    url.rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .unwrap_or("OtakuDeck-update.exe")
        .to_string()
}

pub async fn download_update(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Download HTTP {}", response.status()));
    }

    response
        .bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| e.to_string())
}

pub async fn save_and_install_update(
    app: &tauri::AppHandle,
    url: &str,
) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let update_dir = dir.join("updates");
    std::fs::create_dir_all(&update_dir).map_err(|e| e.to_string())?;

    let filename = filename_from_url(url);
    let path = update_dir.join(filename);

    let bytes = download_update(url).await?;
    if bytes.is_empty() {
        return Err("empty update file".into());
    }

    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;

    #[cfg(mobile)]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_path(path.to_string_lossy(), None::<&str>)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(all(not(mobile), windows))]
    {
        launch_windows_installer(&path)?;
        app.exit(0);
        return Ok(());
    }

    #[cfg(all(not(mobile), not(windows)))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_path(path.to_string_lossy(), None::<&str>)
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(windows)]
fn launch_windows_installer(path: &Path) -> Result<(), String> {
    use std::process::Command;

    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");

    let spawn_result = if ext.eq_ignore_ascii_case("msi") {
        Command::new("msiexec")
            .args(["/i"])
            .arg(path)
            .args(["/passive", "/norestart"])
            .spawn()
    } else {
        Command::new(path).arg("/S").spawn()
    };

    spawn_result.map_err(|e| format!("Failed to start installer: {e}"))?;
    Ok(())
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

    #[test]
    fn filename_from_release_url() {
        assert_eq!(
            filename_from_url(
                "https://github.com/example/releases/download/v0.1.3/OtakuDeck_0.1.3_x64-setup.exe"
            ),
            "OtakuDeck_0.1.3_x64-setup.exe"
        );
    }
}

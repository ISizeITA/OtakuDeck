use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    embed_mal_client_id();
    tauri_build::build();
}

fn embed_mal_client_id() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let bundled_config = manifest_dir.join("bundled/mal.config.json");
    let project_config = manifest_dir.join("../mal.config.json");
    let env_path = manifest_dir.join("../.env");
    let developer_config = developer_mal_config_path();

    let client_id = std::env::var("BUNDLED_MAL_CLIENT_ID")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| read_client_id_from_mal_config(&bundled_config))
        .or_else(|| read_client_id_from_mal_config(&project_config))
        .or_else(|| read_env_var(&env_path, "VITE_MAL_CLIENT_ID"))
        .or_else(|| read_env_var(&env_path, "MAL_CLIENT_ID"))
        .or_else(|| {
            developer_config
                .as_ref()
                .and_then(|path| read_client_id_from_mal_config(path))
        })
        .unwrap_or_default();

    println!("cargo:rerun-if-changed={}", bundled_config.display());
    println!("cargo:rerun-if-changed={}", project_config.display());
    println!("cargo:rerun-if-changed={}", env_path.display());
    if let Some(path) = &developer_config {
        println!("cargo:rerun-if-changed={}", path.display());
    }
    println!("cargo:rustc-env=BUNDLED_MAL_CLIENT_ID={client_id}");
}

fn developer_mal_config_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("LOCALAPPDATA").ok().map(|dir| {
            PathBuf::from(dir)
                .join("OtakuDeck")
                .join("mal.config.json")
        })
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|home| {
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("OtakuDeck")
                .join("mal.config.json")
        })
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::env::var("XDG_DATA_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|home| PathBuf::from(home).join(".local").join("share"))
            })
            .map(|base| base.join("OtakuDeck").join("mal.config.json"))
    }
    #[cfg(not(any(windows, unix)))]
    {
        None
    }
}

fn read_client_id_from_mal_config(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }

    fs::read_to_string(path).ok().and_then(|content| {
        serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| {
                v.get("clientId")
                    .or_else(|| v.get("client_id"))
                    .and_then(|c| c.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .filter(|s| !is_placeholder(s))
                    .map(String::from)
            })
    })
}

fn is_placeholder(value: &str) -> bool {
    value.eq_ignore_ascii_case("your_client_id_here")
        || value.eq_ignore_ascii_case("incolla_il_tuo_client_id_qui")
        || value.starts_with("INCOLLA_QUI")
}

fn read_env_var(path: &Path, key: &str) -> Option<String> {
    if !path.exists() {
        return None;
    }

    let mut content = fs::read_to_string(path).ok()?;
    if content.starts_with('\u{feff}') {
        content = content.trim_start_matches('\u{feff}').to_string();
    }

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((k, v)) = line.split_once('=') else {
            continue;
        };
        if k.trim() != key {
            continue;
        }
        let value = v.trim().trim_matches('"').trim_matches('\'');
        if !value.is_empty() && !is_placeholder(value) {
            return Some(value.to_string());
        }
    }
    None
}

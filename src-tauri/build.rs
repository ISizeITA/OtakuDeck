use std::fs;
use std::path::Path;

fn main() {
    embed_mal_client_id();
    tauri_build::build();
}

fn embed_mal_client_id() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("../mal.config.json");

    let client_id = fs::read_to_string(&config_path)
        .ok()
        .and_then(|content| {
            serde_json::from_str::<serde_json::Value>(&content)
                .ok()
                .and_then(|v| {
                    v.get("clientId")
                        .or_else(|| v.get("client_id"))
                        .and_then(|c| c.as_str())
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(String::from)
                })
        })
        .unwrap_or_default();

    println!("cargo:rerun-if-changed={}", config_path.display());
    println!("cargo:rustc-env=BUNDLED_MAL_CLIENT_ID={client_id}");
}

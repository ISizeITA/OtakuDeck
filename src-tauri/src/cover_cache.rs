use std::fs;
use std::path::{Path, PathBuf};

const COVER_TTL_SECS: i64 = 7 * 24 * 3600;

pub fn covers_dir(base: &Path) -> PathBuf {
    base.join("covers")
}

pub fn cover_path(base: &Path, anime_id: u64) -> PathBuf {
    covers_dir(base).join(format!("{anime_id}.jpg"))
}

pub async fn ensure_cover_cached(
    base: &Path,
    anime_id: u64,
    url: &str,
) -> Result<PathBuf, String> {
    let path = cover_path(base, anime_id);
    if path.exists() && is_fresh(&path) {
        return Ok(path);
    }

    if url.is_empty() {
        return Err("empty cover url".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    if bytes.is_empty() {
        return Err("empty cover response".into());
    }

    fs::create_dir_all(covers_dir(base)).map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn is_fresh(path: &Path) -> bool {
    let Ok(meta) = fs::metadata(path) else {
        return false;
    };
    let Ok(modified) = meta.modified() else {
        return false;
    };
    modified
        .elapsed()
        .map(|elapsed| elapsed.as_secs() as i64 <= COVER_TTL_SECS)
        .unwrap_or(false)
}

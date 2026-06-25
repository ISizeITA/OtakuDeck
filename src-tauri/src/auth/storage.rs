use once_cell::sync::OnceCell;
use std::path::PathBuf;

static APP_STORAGE_DIR: OnceCell<PathBuf> = OnceCell::new();

pub fn set_app_storage_dir(dir: PathBuf) {
    let _ = APP_STORAGE_DIR.set(dir);
}

pub fn app_storage_dir() -> PathBuf {
    APP_STORAGE_DIR
        .get()
        .cloned()
        .or_else(|| {
            dirs::data_local_dir().map(|dir| dir.join("OtakuDeck"))
        })
        .unwrap_or_else(|| PathBuf::from(".").join("OtakuDeck"))
}

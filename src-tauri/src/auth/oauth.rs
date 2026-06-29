use std::collections::HashMap;

#[cfg(not(mobile))]
use std::io::{Read, Write};
#[cfg(not(mobile))]
use std::net::{TcpListener, TcpStream};
#[cfg(not(mobile))]
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
#[cfg(mobile)]
use tauri_plugin_opener::OpenerExt;
use thiserror::Error;
use url::Url;

use super::config::{default_redirect_uri, mal_client_id, OAuthStartOptions, PendingOAuth};
use super::pkce::{generate_pkce_pair, PkcePair};
use super::storage;

const MAL_AUTH_URL: &str = "https://myanimelist.net/v1/oauth2/authorize";
const MAL_TOKEN_URL: &str = "https://myanimelist.net/v1/oauth2/token";
const SESSION_FILE: &str = "session.json";
const PENDING_OAUTH_FILE: &str = "pending_oauth.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub token_type: String,
    #[serde(default)]
    pub obtained_at: i64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
    token_type: String,
}

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("MAL client ID not configured. Set VITE_MAL_CLIENT_ID in .env")]
    MissingClientId,
    #[error("not authenticated")]
    NotAuthenticated,
    #[error("OAuth flow cancelled or timed out")]
    FlowCancelled,
    #[error("invalid redirect URI received")]
    InvalidRedirect,
    #[error("no pending OAuth session")]
    NoPendingOAuth,
    #[error("OAuth state mismatch")]
    StateMismatch,
    #[error("failed to open browser: {0}")]
    BrowserOpen(String),
    #[error("token exchange failed: {0}")]
    TokenExchange(String),
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("PKCE error: {0}")]
    Pkce(#[from] super::pkce::PkceError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

pub struct AuthManager {
    session: Option<AuthSession>,
    session_path: std::path::PathBuf,
    pending_oauth: Option<PendingOAuth>,
    storage_ready: bool,
    account_id: Option<String>,
    oauth_context: OAuthStartOptions,
}

impl AuthManager {
    pub fn new() -> Self {
        Self {
            session: None,
            session_path: std::path::PathBuf::new(),
            pending_oauth: None,
            storage_ready: false,
            account_id: None,
            oauth_context: OAuthStartOptions::default(),
        }
    }

    pub fn bind_account(&mut self, account_id: &str) {
        let session_path = storage::app_storage_dir()
            .join("accounts")
            .join(account_id)
            .join(SESSION_FILE);
        self.account_id = Some(account_id.to_string());
        self.session_path = session_path;
        self.storage_ready = true;
        self.session = Self::load_session(&self.session_path).ok();
    }

    pub fn use_legacy_session_path(&mut self) {
        self.account_id = None;
        self.session_path = storage::app_storage_dir().join(SESSION_FILE);
        self.storage_ready = true;
        self.session = None;
    }

    pub fn take_oauth_context(&mut self) -> OAuthStartOptions {
        std::mem::take(&mut self.oauth_context)
    }

    fn sync_storage_paths(&mut self) {
        if !self.storage_ready {
            if let Some(account_id) = self.account_id.clone() {
                self.bind_account(&account_id);
            } else {
                self.use_legacy_session_path();
            }
        }

        if self.session.is_none() {
            self.session = Self::load_session(&self.session_path).ok();
        }
        if self.pending_oauth.is_none() {
            #[cfg(mobile)]
            {
                self.pending_oauth =
                    Self::load_pending_oauth(&storage::app_storage_dir()).ok();
            }
        }
    }

    pub fn bound_account_id(&self) -> Option<&str> {
        self.account_id.as_deref()
    }

    pub fn get_session(&mut self) -> Option<AuthSession> {
        self.sync_storage_paths();
        self.session.clone()
    }

    pub fn has_pending_oauth(&mut self) -> bool {
        self.sync_storage_paths();
        self.pending_oauth.is_some()
    }

    pub fn logout(&mut self) -> Result<(), AuthError> {
        self.sync_storage_paths();
        self.session = None;
        self.pending_oauth = None;
        if self.session_path.exists() {
            std::fs::remove_file(&self.session_path)?;
        }
        let pending_path = storage::app_storage_dir().join(PENDING_OAUTH_FILE);
        if pending_path.exists() {
            let _ = std::fs::remove_file(pending_path);
        }
        Ok(())
    }

    pub fn is_token_expired(&self) -> bool {
        match &self.session {
            Some(s) => {
                let elapsed = chrono::Utc::now().timestamp() - s.obtained_at;
                elapsed >= s.expires_in as i64 - 300
            }
            None => true,
        }
    }

    pub async fn ensure_valid_token(&mut self) -> Result<String, AuthError> {
        self.sync_storage_paths();
        if self.session.is_none() {
            return Err(AuthError::NotAuthenticated);
        }
        if !self.is_token_expired() {
            return Ok(self.session.as_ref().unwrap().access_token.clone());
        }
        self.refresh_access_token().await
    }

    pub async fn refresh_access_token(&mut self) -> Result<String, AuthError> {
        let refresh_token = self
            .session
            .as_ref()
            .map(|s| s.refresh_token.clone())
            .ok_or(AuthError::NotAuthenticated)?;

        let client_id = mal_client_id().map_err(|_| AuthError::MissingClientId)?;

        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("client_id", client_id.as_str());
        params.insert("grant_type", "refresh_token");
        params.insert("refresh_token", refresh_token.as_str());

        let response = client
            .post(MAL_TOKEN_URL)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AuthError::TokenExchange(body));
        }

        let token: TokenResponse = response.json().await?;
        let session = AuthSession {
            access_token: token.access_token.clone(),
            refresh_token: token.refresh_token,
            expires_in: token.expires_in,
            token_type: token.token_type,
            obtained_at: chrono::Utc::now().timestamp(),
        };
        self.persist_session(&session)?;
        Ok(token.access_token)
    }

    pub async fn start_oauth(
        &mut self,
        _app: AppHandle,
        options: OAuthStartOptions,
    ) -> Result<(), AuthError> {
        self.oauth_context = options.clone();
        if let Some(ref account_id) = options.account_id {
            self.bind_account(account_id);
        } else if options.new_account {
            self.use_legacy_session_path();
        }
        self.sync_storage_paths();
        let client_id = mal_client_id().map_err(|_| AuthError::MissingClientId)?;
        let redirect_uri = default_redirect_uri();
        let pkce = generate_pkce_pair()?;
        let state = generate_state();
        let auth_url = build_auth_url(&client_id, &redirect_uri, &pkce, &state)?;

        #[cfg(mobile)]
        {
            let pending = PendingOAuth {
                code_verifier: pkce.verifier.clone(),
                state: state.clone(),
                redirect_uri: redirect_uri.clone(),
                new_account: options.new_account,
                account_id: options.account_id.clone(),
            };
            self.pending_oauth = Some(pending.clone());
            self.persist_pending_oauth(&pending)?;

            app.opener()
                .open_url(&auth_url, None::<&str>)
                .map_err(|e| AuthError::BrowserOpen(e.to_string()))?;

            return Ok(());
        }

        #[cfg(not(mobile))]
        {
            let (ready_tx, ready_rx) = std::sync::mpsc::channel();
            let redirect_uri_for_listener = redirect_uri.clone();
            let state_for_listener = state.clone();

            let code_handle = tokio::task::spawn_blocking(move || {
                listen_for_callback(&redirect_uri_for_listener, &state_for_listener, ready_tx)
            });

            ready_rx
                .recv()
                .map_err(|_| AuthError::FlowCancelled)?;

            tauri_plugin_opener::open_url(&auth_url, None::<&str>)
                .map_err(|e| AuthError::BrowserOpen(e.to_string()))?;

            let code = code_handle
                .await
                .map_err(|e| AuthError::TokenExchange(e.to_string()))??;

            let session =
                exchange_code(&client_id, &redirect_uri, &code, &pkce.verifier).await?;
            self.persist_session(&session)?;
            self.pending_oauth = None;

            Ok(())
        }
    }

    pub async fn complete_oauth(
        &mut self,
        _app: AppHandle,
        code: String,
        state: String,
    ) -> Result<(), AuthError> {
        self.sync_storage_paths();
        let pending = self
            .pending_oauth
            .take()
            .or_else(|| {
                #[cfg(mobile)]
                {
                    return Self::load_pending_oauth(&storage::app_storage_dir()).ok();
                }
                #[cfg(not(mobile))]
                {
                    None
                }
            })
            .ok_or(AuthError::NoPendingOAuth)?;

        if pending.state != state {
            self.pending_oauth = Some(pending);
            return Err(AuthError::StateMismatch);
        }

        let client_id = mal_client_id().map_err(|_| AuthError::MissingClientId)?;
        let session = exchange_code(
            &client_id,
            &pending.redirect_uri,
            &code,
            &pending.code_verifier,
        )
        .await?;

        self.persist_session(&session)?;
        #[cfg(mobile)]
        self.clear_pending_oauth()?;

        Ok(())
    }

    #[cfg(mobile)]
    fn persist_pending_oauth(&self, pending: &PendingOAuth) -> Result<(), AuthError> {
        let dir = storage::app_storage_dir();
        std::fs::create_dir_all(&dir)?;
        let json = serde_json::to_string_pretty(pending)?;
        std::fs::write(dir.join(PENDING_OAUTH_FILE), json)?;
        Ok(())
    }

    #[cfg(mobile)]
    fn load_pending_oauth(dir: &std::path::Path) -> Result<PendingOAuth, AuthError> {
        let content = std::fs::read_to_string(dir.join(PENDING_OAUTH_FILE))?;
        Ok(serde_json::from_str(&content)?)
    }

    #[cfg(mobile)]
    fn clear_pending_oauth(&self) -> Result<(), AuthError> {
        let path = storage::app_storage_dir().join(PENDING_OAUTH_FILE);
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }

    pub fn relocate_session_to_account(&mut self, account_id: &str) -> Result<(), AuthError> {
        let session = self
            .session
            .clone()
            .ok_or(AuthError::NotAuthenticated)?;
        self.bind_account(account_id);
        self.persist_session(&session)?;

        let legacy = storage::app_storage_dir().join(SESSION_FILE);
        if legacy.exists() && legacy != self.session_path {
            let _ = std::fs::remove_file(legacy);
        }
        Ok(())
    }

    fn persist_session(&mut self, session: &AuthSession) -> Result<(), AuthError> {
        if let Some(parent) = self.session_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(session)?;
        std::fs::write(&self.session_path, json)?;
        self.session = Some(session.clone());
        Ok(())
    }

    fn load_session(path: &std::path::Path) -> Result<AuthSession, AuthError> {
        let content = std::fs::read_to_string(path)?;
        let mut session: AuthSession = serde_json::from_str(&content)?;
        if session.obtained_at <= 0 {
            session.obtained_at = chrono::Utc::now().timestamp();
        }
        Ok(session)
    }
}

fn generate_state() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| format!("{:x}", rng.gen_range(0..16)))
        .collect()
}

fn build_auth_url(
    client_id: &str,
    redirect_uri: &str,
    pkce: &PkcePair,
    state: &str,
) -> Result<String, AuthError> {
    let mut url = Url::parse(MAL_AUTH_URL).map_err(|_| AuthError::InvalidRedirect)?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", client_id)
        .append_pair("code_challenge", &pkce.challenge)
        .append_pair("code_challenge_method", "plain")
        .append_pair("state", state)
        .append_pair("redirect_uri", redirect_uri);
    Ok(url.to_string())
}

#[cfg(not(mobile))]
fn listen_for_callback(
    redirect_uri: &str,
    expected_state: &str,
    ready: std::sync::mpsc::Sender<()>,
) -> Result<String, AuthError> {
    let parsed = Url::parse(redirect_uri).map_err(|_| AuthError::InvalidRedirect)?;
    let host = parsed.host_str().unwrap_or("127.0.0.1");
    let port = parsed.port().unwrap_or(14568);
    let bind_addr = format!("{host}:{port}");

    let listener = TcpListener::bind(&bind_addr)?;
    listener.set_nonblocking(false)?;
    let _ = ready.send(());

    for stream in listener.incoming() {
        let mut stream = stream?;
        let request = read_http_request(&mut stream)?;
        let code = extract_query_param(&request, "code").ok_or(AuthError::InvalidRedirect)?;
        let state = extract_query_param(&request, "state").unwrap_or_default();

        if state != expected_state {
            send_html_response(&mut stream, false);
            return Err(AuthError::InvalidRedirect);
        }

        send_html_response(&mut stream, true);
        return Ok(code);
    }

    Err(AuthError::FlowCancelled)
}

#[cfg(not(mobile))]
fn read_http_request(stream: &mut TcpStream) -> Result<String, AuthError> {
    stream.set_read_timeout(Some(Duration::from_secs(120)))?;
    let mut buffer = [0u8; 4096];
    let n = stream.read(&mut buffer)?;
    Ok(String::from_utf8_lossy(&buffer[..n]).to_string())
}

#[cfg(not(mobile))]
fn extract_query_param_from_url(url: &str, key: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    parsed
        .query_pairs()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.into_owned())
}

#[cfg(not(mobile))]
fn extract_query_param(request: &str, key: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    if path.starts_with("otakudeck://") || path.starts_with("http") {
        return extract_query_param_from_url(path, key);
    }
    let query = path.split('?').nth(1)?;
    let params: HashMap<_, _> = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();
    params.get(key).cloned()
}

#[cfg(not(mobile))]
fn send_html_response(stream: &mut TcpStream, success: bool) {
    let body = oauth_result_html(success);
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[cfg(not(mobile))]
fn oauth_result_html(success: bool) -> &'static str {
    if success {
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><title>OtakuDeck</title>
        <style>body{font-family:Inter,sans-serif;background:#121214;color:#f0f0f2;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        .card{text-align:center;padding:48px;border-radius:20px;background:#1a1a1e;
        border:1px solid rgba(255,255,255,.06)}h1{background:linear-gradient(135deg,#ff5e3a,#ffb900);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px}</style></head>
        <body><div class="card"><h1>Autenticazione riuscita!</h1>
        <p>Puoi chiudere questa finestra e tornare a OtakuDeck.</p></div></body></html>"#
    } else {
        r#"<!DOCTYPE html><html><body style="background:#121214;color:#ff8080;font-family:sans-serif;
        display:flex;align-items:center;justify-content:center;height:100vh">
        <p>Errore di autenticazione. Riprova da OtakuDeck.</p></body></html>"#
    }
}

async fn exchange_code(
    client_id: &str,
    redirect_uri: &str,
    code: &str,
    code_verifier: &str,
) -> Result<AuthSession, AuthError> {
    let client = Client::new();

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("grant_type", "authorization_code");
    params.insert("code", code);
    params.insert("redirect_uri", redirect_uri);
    params.insert("code_verifier", code_verifier);

    let response = client
        .post(MAL_TOKEN_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AuthError::TokenExchange(body));
    }

    let token: TokenResponse = response.json().await?;
    Ok(AuthSession {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
        token_type: token.token_type,
        obtained_at: chrono::Utc::now().timestamp(),
    })
}
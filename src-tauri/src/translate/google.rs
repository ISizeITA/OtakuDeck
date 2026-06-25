use reqwest::Client;
use thiserror::Error;

use super::split::split_text;

const DEFAULT_API_URL: &str = "https://translation.googleapis.com/language/translate/v2";
const MAX_CHUNK_LEN: usize = 4500;

#[derive(Error, Debug)]
pub enum GoogleTranslateError {
    #[error("Google Translate API key not configured")]
    MissingApiKey,
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("translation failed ({status}): {body}")]
    Api { status: u16, body: String },
    #[error("empty translation response")]
    EmptyResponse,
}

pub struct GoogleTranslateClient {
    api_url: String,
    api_key: String,
    http: Client,
}

impl GoogleTranslateClient {
    pub fn new(api_key: &str, api_url: Option<&str>) -> Result<Self, GoogleTranslateError> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err(GoogleTranslateError::MissingApiKey);
        }

        let url = api_url
            .map(|u| u.trim().trim_end_matches('/').to_string())
            .filter(|u| !u.is_empty())
            .unwrap_or_else(|| DEFAULT_API_URL.to_string());

        Ok(Self {
            api_url: url,
            api_key: key.to_string(),
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap_or_else(|_| Client::new()),
        })
    }

    pub async fn translate(
        &self,
        text: &str,
        source: &str,
        target: &str,
    ) -> Result<String, GoogleTranslateError> {
        if text.len() <= MAX_CHUNK_LEN {
            return self.translate_chunk(text, source, target).await;
        }

        let mut result = String::new();
        for chunk in split_text(text, MAX_CHUNK_LEN) {
            let part = self.translate_chunk(&chunk, source, target).await?;
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&part);
        }
        Ok(result)
    }

    pub async fn check(&self) -> Result<(), GoogleTranslateError> {
        self.translate_chunk("hello", "en", "it").await?;
        Ok(())
    }

    async fn translate_chunk(
        &self,
        text: &str,
        source: &str,
        target: &str,
    ) -> Result<String, GoogleTranslateError> {
        let url = format!("{}?key={}", self.api_url, self.api_key);
        let body = serde_json::json!({
            "q": text,
            "source": source,
            "target": target,
            "format": "text"
        });

        let response = self.http.post(&url).json(&body).send().await?;
        let status = response.status().as_u16();
        let raw = response.text().await?;

        if !(200..300).contains(&status) {
            return Err(GoogleTranslateError::Api {
                status,
                body: raw,
            });
        }

        let parsed: GoogleResponse =
            serde_json::from_str(&raw).map_err(|_| GoogleTranslateError::Api {
                status,
                body: raw.clone(),
            })?;

        let translated = parsed
            .data
            .translations
            .first()
            .map(|t| t.translated_text.trim().to_string())
            .unwrap_or_default();

        if translated.is_empty() {
            return Err(GoogleTranslateError::EmptyResponse);
        }

        Ok(translated)
    }
}

#[derive(Debug, serde::Deserialize)]
struct GoogleResponse {
    data: GoogleResponseData,
}

#[derive(Debug, serde::Deserialize)]
struct GoogleResponseData {
    translations: Vec<GoogleTranslation>,
}

#[derive(Debug, serde::Deserialize)]
struct GoogleTranslation {
    #[serde(rename = "translatedText")]
    translated_text: String,
}

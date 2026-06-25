use reqwest::Client;
use thiserror::Error;

use super::split::split_text;

const DEFAULT_API_URL: &str = "https://api-free.deepl.com/v2/translate";
const MAX_CHUNK_LEN: usize = 4000;

#[derive(Error, Debug)]
pub enum DeepLError {
    #[error("DeepL API key not configured")]
    MissingApiKey,
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("translation failed ({status}): {body}")]
    Api { status: u16, body: String },
    #[error("empty translation response")]
    EmptyResponse,
}

pub struct DeepLClient {
    api_url: String,
    api_key: String,
    http: Client,
}

impl DeepLClient {
    pub fn new(api_key: &str, api_url: Option<&str>) -> Result<Self, DeepLError> {
        let key = api_key.trim();
        if key.is_empty() {
            return Err(DeepLError::MissingApiKey);
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
    ) -> Result<String, DeepLError> {
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

    pub async fn check(&self) -> Result<(), DeepLError> {
        self.translate_chunk("hello", "en", "it").await?;
        Ok(())
    }

    async fn translate_chunk(
        &self,
        text: &str,
        source: &str,
        target: &str,
    ) -> Result<String, DeepLError> {
        let form = [
            ("text", text),
            ("source_lang", &to_deepl_lang(source)),
            ("target_lang", &to_deepl_lang(target)),
        ];

        let response = self
            .http
            .post(&self.api_url)
            .header("Authorization", format!("DeepL-Auth-Key {}", self.api_key))
            .form(&form)
            .send()
            .await?;

        let status = response.status().as_u16();
        let raw = response.text().await?;

        if !(200..300).contains(&status) {
            return Err(DeepLError::Api {
                status,
                body: raw,
            });
        }

        let parsed: DeepLResponse = serde_json::from_str(&raw).map_err(|_| DeepLError::Api {
            status,
            body: raw,
        })?;

        let translated = parsed
            .translations
            .first()
            .map(|t| t.text.trim().to_string())
            .unwrap_or_default();

        if translated.is_empty() {
            return Err(DeepLError::EmptyResponse);
        }

        Ok(translated)
    }
}

fn to_deepl_lang(code: &str) -> String {
    match code.to_lowercase().as_str() {
        "it" => "IT".to_string(),
        "en" => "EN".to_string(),
        other => other.to_uppercase(),
    }
}

#[derive(Debug, serde::Deserialize)]
struct DeepLResponse {
    translations: Vec<DeepLTranslation>,
}

#[derive(Debug, serde::Deserialize)]
struct DeepLTranslation {
    text: String,
}

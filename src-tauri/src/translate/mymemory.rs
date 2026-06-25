use reqwest::Client;
use thiserror::Error;

use super::split::split_text;

const MYMEMORY_API: &str = "https://api.mymemory.translated.net/get";
const MAX_CHUNK_LEN: usize = 450;

#[derive(Error, Debug)]
pub enum MyMemoryError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("translation failed ({status}): {body}")]
    Api { status: u16, body: String },
    #[error("daily translation quota reached")]
    QuotaExceeded,
    #[error("empty translation response")]
    EmptyResponse,
}

pub struct MyMemoryClient {
    email: Option<String>,
    http: Client,
}

impl MyMemoryClient {
    pub fn new(email: Option<&str>) -> Self {
        Self {
            email: email
                .map(|e| e.trim().to_string())
                .filter(|e| !e.is_empty()),
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    pub async fn translate(
        &self,
        text: &str,
        source: &str,
        target: &str,
    ) -> Result<String, MyMemoryError> {
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

    pub async fn check(&self) -> Result<(), MyMemoryError> {
        self.translate_chunk("hello", "en", "it").await?;
        Ok(())
    }

    async fn translate_chunk(
        &self,
        text: &str,
        source: &str,
        target: &str,
    ) -> Result<String, MyMemoryError> {
        let langpair = format!("{source}|{target}");
        let mut query = vec![("q", text.to_string()), ("langpair", langpair)];

        if let Some(ref email) = self.email {
            query.push(("de", email.clone()));
        }

        let response = self.http.get(MYMEMORY_API).query(&query).send().await?;
        let status = response.status().as_u16();
        let raw = response.text().await?;

        if !(200..300).contains(&status) {
            return Err(MyMemoryError::Api {
                status,
                body: raw,
            });
        }

        let parsed: MyMemoryResponse = serde_json::from_str(&raw).map_err(|_| MyMemoryError::Api {
            status,
            body: raw,
        })?;

        if parsed.quota_finished.unwrap_or(false) || parsed.response_status != 200 {
            if parsed.response_details.to_lowercase().contains("quota")
                || parsed.quota_finished.unwrap_or(false)
            {
                return Err(MyMemoryError::QuotaExceeded);
            }
            return Err(MyMemoryError::Api {
                status: parsed.response_status,
                body: parsed.response_details,
            });
        }

        let translated = parsed.response_data.translated_text.trim().to_string();
        if translated.is_empty() {
            return Err(MyMemoryError::EmptyResponse);
        }

        Ok(translated)
    }
}

#[derive(Debug, serde::Deserialize)]
struct MyMemoryResponse {
    #[serde(rename = "responseData")]
    response_data: MyMemoryResponseData,
    #[serde(rename = "responseStatus")]
    response_status: u16,
    #[serde(default, rename = "responseDetails")]
    response_details: String,
    #[serde(default, rename = "quotaFinished")]
    quota_finished: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
struct MyMemoryResponseData {
    #[serde(rename = "translatedText")]
    translated_text: String,
}

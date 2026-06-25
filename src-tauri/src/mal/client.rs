use std::collections::HashMap;

use reqwest::Client;
use serde::de::DeserializeOwned;
use thiserror::Error;

use super::types::*;
use crate::auth;

const MAL_API_BASE: &str = "https://api.myanimelist.net/v2";

#[derive(Error, Debug)]
pub enum MalError {
    #[error("not authenticated")]
    NotAuthenticated,
    #[error("configuration error: {0}")]
    Config(String),
    #[error("API error ({status}): {body}")]
    Api { status: u16, body: String },
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

pub struct MalClient;

impl MalClient {
    pub async fn search_anime(
        token: &str,
        params: &SearchAnimeParams,
    ) -> Result<AnimeSearchResponse, MalError> {
        let mut query_text = params
            .query
            .as_ref()
            .map(|q| q.trim().to_string())
            .filter(|q| !q.is_empty());

        // MAL richiede q con min 3 caratteri su GET /anime — usa il nome genere se serve
        if query_text.as_ref().map(|q| q.len()).unwrap_or(0) < 3 {
            if let Some(ref genres) = params.genres {
                let ids = parse_genre_ids(genres);
                if ids.len() == 1 {
                    if let Some(name) = genre_id_to_name(ids[0]) {
                        query_text = Some(name.to_string());
                    }
                }
            }
        }

        if let Some(ref q) = query_text {
            if q.len() >= 3 && q.len() <= 64 {
                return Self::search_with_query(token, params, q).await;
            }
            if q.len() < 3 {
                return Ok(empty_search_response());
            }
        }

        Self::browse_via_ranking(token, params).await
    }

    async fn search_with_query(
        token: &str,
        params: &SearchAnimeParams,
        q: &str,
    ) -> Result<AnimeSearchResponse, MalError> {
        let mut query = vec![
            ("q", q.to_string()),
            ("limit", params.limit.unwrap_or(24).to_string()),
            ("offset", params.offset.unwrap_or(0).to_string()),
            ("fields", ANIME_CARD_FIELDS.to_string()),
        ];

        if let Some(g) = &params.genres {
            let ids = parse_genre_ids(g);
            if !ids.is_empty() {
                let api_genres = ids
                    .iter()
                    .take(2)
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(",");
                query.push(("genres", api_genres));
            }
        }
        if let Some(t) = &params.media_type {
            if !t.is_empty() {
                query.push(("type", t.clone()));
            }
        }
        if let Some(s) = &params.status {
            query.push(("status", s.clone()));
        }
        if let Some(sort) = &params.sort {
            query.push(("sort", sort.clone()));
        }
        if let Some(order) = &params.order {
            query.push(("order", order.clone()));
        }
        if let Some(ms) = params.min_score {
            query.push(("min_score", ms.to_string()));
        }
        if let Some(sd) = &params.start_date {
            query.push(("start_date", sd.clone()));
        }
        if let Some(ed) = &params.end_date {
            query.push(("end_date", ed.clone()));
        }

        let mut resp: AnimeSearchResponse = Self::get(token, "/anime", &query).await?;
        apply_client_filters(&mut resp, params);
        dedupe_search_results(&mut resp);
        Ok(resp)
    }

    async fn browse_via_ranking(
        token: &str,
        params: &SearchAnimeParams,
    ) -> Result<AnimeSearchResponse, MalError> {
        let ranking_type = ranking_type_for_params(params);
        let limit = params.limit.unwrap_or(24) as usize;
        let skip = params.offset.unwrap_or(0) as usize;

        if !needs_filtered_browse(params) {
            let mut resp = Self::get_anime_ranking(
                token,
                ranking_type,
                params.limit.unwrap_or(24),
                params.offset.unwrap_or(0),
            )
            .await?;
            dedupe_search_results(&mut resp);
            return Ok(resp);
        }

        let mut collected = Vec::new();
        let mut matched_seen = 0usize;
        let mut ranking_offset = 0u32;
        let batch_size = 100u32;

        loop {
            let mut resp =
                Self::get_anime_ranking(token, ranking_type, batch_size, ranking_offset).await?;
            let has_next = resp
                .paging
                .as_ref()
                .and_then(|p| p.next.as_ref())
                .is_some();

            apply_client_filters(&mut resp, params);
            dedupe_search_results(&mut resp);

            for entry in resp.data {
                if matched_seen < skip {
                    matched_seen += 1;
                    continue;
                }
                collected.push(entry);
                if collected.len() >= limit {
                    break;
                }
            }

            if collected.len() >= limit || !has_next {
                break;
            }
            ranking_offset += batch_size;
        }

        let has_more = collected.len() >= limit;
        Ok(AnimeSearchResponse {
            data: collected,
            paging: if has_more {
                Some(Paging {
                    previous: None,
                    next: Some("more".to_string()),
                })
            } else {
                None
            },
        })
    }

    pub async fn get_anime_details(token: &str, id: u64) -> Result<AnimeNode, MalError> {
        let query = [("fields", ANIME_FIELDS.to_string())];
        Self::get(token, &format!("/anime/{id}"), &query).await
    }

    pub async fn get_anime_ranking(
        token: &str,
        ranking_type: &str,
        limit: u32,
        offset: u32,
    ) -> Result<AnimeSearchResponse, MalError> {
        let query = [
            ("ranking_type", ranking_type.to_string()),
            ("limit", limit.to_string()),
            ("offset", offset.to_string()),
            ("fields", ANIME_CARD_FIELDS.to_string()),
        ];
        Self::get(token, "/anime/ranking", &query).await
    }

    pub async fn get_seasonal_anime(
        token: &str,
        year: u32,
        season: &str,
        limit: u32,
        offset: u32,
    ) -> Result<AnimeSearchResponse, MalError> {
        let query = [
            ("limit", limit.to_string()),
            ("offset", offset.to_string()),
            ("fields", ANIME_CARD_FIELDS.to_string()),
        ];
        Self::get(
            token,
            &format!("/anime/season/{year}/{season}"),
            &query,
        )
        .await
    }

    pub async fn get_user_animelist(
        token: &str,
        status: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<AnimeListResponse, MalError> {
        let mut query = vec![
            ("limit", limit.to_string()),
            ("offset", offset.to_string()),
            ("fields", LIST_NODE_FIELDS.to_string()),
        ];
        if let Some(s) = status {
            query.push(("status", s.to_string()));
        }
        Self::get(token, "/users/@me/animelist", &query).await
    }

    pub async fn get_user_profile(token: &str) -> Result<UserProfile, MalError> {
        let query = [("fields", USER_FIELDS.to_string())];
        Self::get(token, "/users/@me", &query).await
    }

    pub async fn update_list_status(
        token: &str,
        anime_id: u64,
        update: &UpdateListStatusRequest,
    ) -> Result<MyListStatus, MalError> {
        let mut form: HashMap<&str, String> = HashMap::new();
        if let Some(s) = &update.status {
            form.insert("status", s.clone());
        }
        if let Some(score) = update.score {
            form.insert("score", score.to_string());
        }
        if let Some(ep) = update.num_watched_episodes {
            form.insert("num_watches_episodes", ep.to_string());
        }

        let client = Client::new();
        let client_id = auth::mal_client_id().map_err(MalError::Config)?;

        let response = client
            .put(format!("{MAL_API_BASE}/anime/{anime_id}/my_list_status"))
            .header("Authorization", format!("Bearer {token}"))
            .header("X-MAL-CLIENT-ID", client_id)
            .form(&form)
            .send()
            .await?;

        let status = response.status().as_u16();
        let body = response.text().await?;

        if !((200..300).contains(&status)) {
            return Err(MalError::Api { status, body });
        }

        serde_json::from_str(&body).map_err(MalError::Parse)
    }

    async fn get<T: DeserializeOwned>(
        token: &str,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<T, MalError> {
        let client = Client::new();
        let client_id = auth::mal_client_id().map_err(MalError::Config)?;

        let url = format!("{MAL_API_BASE}{path}");
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("X-MAL-CLIENT-ID", client_id)
            .query(query)
            .send()
            .await?;

        let status = response.status().as_u16();
        let body = response.text().await?;

        if !((200..300).contains(&status)) {
            return Err(MalError::Api { status, body });
        }

        serde_json::from_str(&body).map_err(MalError::Parse)
    }

    pub async fn get_all_user_anime_ids(token: &str) -> Result<Vec<u64>, MalError> {
        let mut ids = Vec::new();
        let mut offset = 0u32;
        loop {
            let resp = Self::get_user_animelist(token, None, 100, offset).await?;
            for entry in &resp.data {
                ids.push(entry.node.id);
            }
            if resp.paging.as_ref().and_then(|p| p.next.as_ref()).is_some() {
                offset += 100;
            } else {
                break;
            }
            if resp.data.is_empty() {
                break;
            }
        }
        Ok(ids)
    }
}

fn empty_search_response() -> AnimeSearchResponse {
    AnimeSearchResponse {
        data: vec![],
        paging: None,
    }
}

fn ranking_type_for_params(params: &SearchAnimeParams) -> &'static str {
    if let Some(t) = &params.media_type {
        match t.as_str() {
            "tv" => return "tv",
            "ova" => return "ova",
            "movie" => return "movie",
            "special" => return "special",
            _ => {}
        }
    }
    if params.status.as_deref() == Some("airing") {
        return "airing";
    }
    "all"
}

fn needs_filtered_browse(params: &SearchAnimeParams) -> bool {
    !parse_genre_ids(params.genres.as_deref().unwrap_or("")).is_empty()
        || params.start_date.is_some()
        || params.end_date.is_some()
}

fn dedupe_search_results(resp: &mut AnimeSearchResponse) {
    let mut seen = std::collections::HashSet::new();
    resp.data.retain(|entry| seen.insert(entry.node.id));
}

fn apply_client_filters(resp: &mut AnimeSearchResponse, params: &SearchAnimeParams) {
    if let Some(ref genres) = params.genres {
        let ids = parse_genre_ids(genres);
        if !ids.is_empty() {
            resp.data.retain(|entry| {
                entry
                    .node
                    .genres
                    .as_ref()
                    .map(|gs| ids.iter().all(|id| gs.iter().any(|g| g.id == *id)))
                    .unwrap_or(false)
            });
        }
    }

    if let Some(ref media_type) = params.media_type {
        if !media_type.is_empty() {
            resp.data.retain(|entry| {
                entry
                    .node
                    .media_type
                    .as_deref()
                    .map(|t| t == media_type)
                    .unwrap_or(false)
            });
        }
    }

    if let Some(ref start) = params.start_date {
        resp.data.retain(|entry| {
            entry
                .node
                .start_date
                .as_deref()
                .map(|d| d >= start.as_str())
                .unwrap_or(false)
        });
    }

    if let Some(ref end) = params.end_date {
        resp.data.retain(|entry| {
            entry
                .node
                .start_date
                .as_deref()
                .map(|d| d <= end.as_str())
                .unwrap_or(false)
        });
    }
}

fn parse_genre_ids(genres: &str) -> Vec<u64> {
    genres
        .split(',')
        .filter_map(|s| s.trim().parse::<u64>().ok())
        .collect()
}

fn genre_id_to_name(id: u64) -> Option<&'static str> {
    match id {
        1 => Some("Action"),
        2 => Some("Adventure"),
        4 => Some("Comedy"),
        8 => Some("Drama"),
        10 => Some("Fantasy"),
        14 => Some("Horror"),
        18 => Some("Mecha"),
        22 => Some("Romance"),
        24 => Some("Sci-Fi"),
        36 => Some("Slice of Life"),
        37 => Some("Sports"),
        40 => Some("Psychological"),
        41 => Some("Suspense"),
        23 => Some("School"),
        27 => Some("Shounen"),
        _ => None,
    }
}

use std::collections::HashMap;
use std::time::Duration;

use once_cell::sync::Lazy;
use reqwest::Client;
use serde::de::DeserializeOwned;
use thiserror::Error;
use tokio::sync::Semaphore;

use super::types::*;
use crate::auth;

const MAL_API_BASE: &str = "https://api.myanimelist.net/v2";
const ANIMELIST_PAGE_SIZE: u32 = 50;
const ANIMELIST_PAGE_DELAY: Duration = Duration::from_millis(350);
const MAX_RETRIES: u32 = 4;
const MAL_MAX_CONCURRENT: usize = 2;

static HTTP: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(45))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .expect("mal http client")
});

static MAL_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(MAL_MAX_CONCURRENT));

#[derive(Error, Debug)]
pub enum MalError {
    #[error("not authenticated")]
    NotAuthenticated,
    #[error("configuration error: {0}")]
    Config(String),
    #[error("{0}")]
    Api(String),
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

impl MalError {
    fn is_retryable(&self) -> bool {
        match self {
            MalError::Network(e) => e.is_timeout() || e.is_connect() || e.is_request(),
            MalError::Api(msg) => msg.contains("(502)")
                || msg.contains("(503)")
                || msg.contains("(504)")
                || msg.contains("(429)"),
            _ => false,
        }
    }

    fn from_api_status(status: u16, body: &str) -> Self {
        MalError::Api(format_api_error(status, body))
    }
}

fn format_api_error(status: u16, body: &str) -> String {
    if matches!(status, 502 | 503 | 504) {
        return format!(
            "MyAnimeList non risponde (errore {status}). Riprova tra qualche secondo."
        );
    }
    if status == 429 {
        return "Troppe richieste a MyAnimeList. Attendi un momento e riprova.".to_string();
    }
    let trimmed = sanitize_error_body(body);
    if trimmed.is_empty() {
        format!("Errore API MyAnimeList ({status})")
    } else {
        format!("Errore API ({status}): {trimmed}")
    }
}

fn sanitize_error_body(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.starts_with('<') {
        return String::new();
    }
    if trimmed.len() > 180 {
        format!("{}…", &trimmed[..180])
    } else {
        trimmed.to_string()
    }
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

        if query_text.as_ref().map(|q| q.len()).unwrap_or(0) < 3 {
            if let Some(ref media_type) = params.media_type {
                if let Some(q) = search_query_for_media_type(media_type) {
                    query_text = Some(q);
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

        let mut has_more_pages = false;

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

            if collected.len() >= limit {
                has_more_pages = has_next;
                break;
            }
            if !has_next {
                break;
            }
            ranking_offset += batch_size;
        }

        Ok(AnimeSearchResponse {
            data: collected,
            paging: if has_more_pages {
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
            ("fields", HOME_CARD_FIELDS.to_string()),
        ];
        Self::get(token, "/anime/ranking", &query).await
    }

    pub async fn get_anime_ranking_with_fields(
        token: &str,
        ranking_type: &str,
        limit: u32,
        offset: u32,
        fields: &str,
    ) -> Result<AnimeSearchResponse, MalError> {
        let query = [
            ("ranking_type", ranking_type.to_string()),
            ("limit", limit.to_string()),
            ("offset", offset.to_string()),
            ("fields", fields.to_string()),
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
            ("fields", HOME_CARD_FIELDS.to_string()),
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

    pub async fn update_user_profile(
        token: &str,
        update: &UpdateUserProfileRequest,
    ) -> Result<UserProfile, MalError> {
        let mut form: HashMap<&str, String> = HashMap::new();
        if let Some(g) = &update.gender {
            form.insert("gender", g.clone());
        }
        if let Some(l) = &update.location {
            form.insert("location", l.clone());
        }
        if let Some(b) = &update.birthday {
            form.insert("birthday", b.clone());
        }
        if let Some(tz) = &update.time_zone {
            form.insert("time_zone", tz.clone());
        }
        if let Some(a) = &update.about {
            form.insert("about", a.clone());
        }

        let client_id = auth::mal_client_id().map_err(MalError::Config)?;

        let response = HTTP
            .patch(format!("{MAL_API_BASE}/users/@me"))
            .header("Authorization", format!("Bearer {token}"))
            .header("X-MAL-CLIENT-ID", client_id)
            .form(&form)
            .query(&[("fields", USER_FIELDS.to_string())])
            .send()
            .await?;

        let status = response.status().as_u16();
        let body = response.text().await?;

        if !((200..300).contains(&status)) {
            return Err(MalError::from_api_status(status, &body));
        }

        serde_json::from_str(&body).map_err(MalError::Parse)
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
            form.insert("num_watched_episodes", ep.to_string());
        }

        let client_id = auth::mal_client_id().map_err(MalError::Config)?;

        let response = HTTP
            .put(format!("{MAL_API_BASE}/anime/{anime_id}/my_list_status"))
            .header("Authorization", format!("Bearer {token}"))
            .header("X-MAL-CLIENT-ID", client_id)
            .form(&form)
            .send()
            .await?;

        let status = response.status().as_u16();
        let body = response.text().await?;

        if !((200..300).contains(&status)) {
            return Err(MalError::from_api_status(status, &body));
        }

        serde_json::from_str(&body).map_err(MalError::Parse)
    }

    async fn get<T: DeserializeOwned>(
        token: &str,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<T, MalError> {
        let mut attempt = 0u32;
        loop {
            match Self::get_once::<T>(token, path, query).await {
                Ok(value) => return Ok(value),
                Err(err) if err.is_retryable() && attempt < MAX_RETRIES => {
                    attempt += 1;
                    let delay = Duration::from_millis(1200 * 2u64.pow(attempt - 1));
                    tokio::time::sleep(delay).await;
                }
                Err(err) => return Err(err),
            }
        }
    }

    async fn get_once<T: DeserializeOwned>(
        token: &str,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<T, MalError> {
        let _permit = MAL_SEMAPHORE
            .acquire()
            .await
            .map_err(|_| MalError::Api("MAL request queue closed".to_string()))?;

        let client_id = auth::mal_client_id().map_err(MalError::Config)?;

        let url = format!("{MAL_API_BASE}{path}");
        let response = HTTP
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("X-MAL-CLIENT-ID", client_id)
            .query(query)
            .send()
            .await?;

        let status = response.status().as_u16();
        let body = response.text().await?;

        if !((200..300).contains(&status)) {
            return Err(MalError::from_api_status(status, &body));
        }

        serde_json::from_str(&body).map_err(MalError::Parse)
    }

    pub async fn get_all_user_anime_ids(token: &str) -> Result<Vec<u64>, MalError> {
        let entries = Self::fetch_all_user_animelist(token).await?;
        Ok(entries.into_iter().map(|e| e.node.id).collect())
    }

    pub async fn fetch_all_user_animelist_with_status(
        token: &str,
        status: Option<&str>,
    ) -> Result<Vec<AnimeListEntry>, MalError> {
        let mut entries = Vec::new();
        let mut offset = 0u32;
        loop {
            let resp =
                Self::get_user_animelist(token, status, ANIMELIST_PAGE_SIZE, offset).await?;
            let has_next = resp
                .paging
                .as_ref()
                .and_then(|p| p.next.as_ref())
                .is_some();
            let batch_len = resp.data.len();
            entries.extend(resp.data);
            if !has_next || batch_len == 0 {
                break;
            }
            offset += ANIMELIST_PAGE_SIZE;
            tokio::time::sleep(ANIMELIST_PAGE_DELAY).await;
        }
        Ok(entries)
    }

    pub async fn fetch_all_user_animelist_reporting<F>(
        token: &str,
        total_hint: Option<u32>,
        mut on_progress: F,
    ) -> Result<Vec<AnimeListEntry>, MalError>
    where
        F: FnMut(u32, Option<u32>),
    {
        let mut entries = Vec::new();
        let mut offset = 0u32;
        loop {
            let resp =
                Self::get_user_animelist(token, None, ANIMELIST_PAGE_SIZE, offset).await?;
            let has_next = resp
                .paging
                .as_ref()
                .and_then(|p| p.next.as_ref())
                .is_some();
            let batch_len = resp.data.len();
            entries.extend(resp.data);
            on_progress(entries.len() as u32, total_hint);
            if !has_next || batch_len == 0 {
                break;
            }
            offset += ANIMELIST_PAGE_SIZE;
            tokio::time::sleep(ANIMELIST_PAGE_DELAY).await;
        }
        Ok(entries)
    }

    pub async fn fetch_all_user_animelist(token: &str) -> Result<Vec<AnimeListEntry>, MalError> {
        Self::fetch_all_user_animelist_with_status(token, None).await
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

fn search_query_for_media_type(media_type: &str) -> Option<String> {
    match media_type {
        "ona" => Some("ona".to_string()),
        "music" => Some("music".to_string()),
        "movie" => Some("movie".to_string()),
        "special" => Some("special".to_string()),
        "ova" => Some("ova".to_string()),
        "tv" => Some("anime".to_string()),
        _ => None,
    }
}

fn needs_filtered_browse(params: &SearchAnimeParams) -> bool {
    !parse_genre_ids(params.genres.as_deref().unwrap_or("")).is_empty()
        || !parse_genre_ids(params.exclude_genres.as_deref().unwrap_or("")).is_empty()
        || params.start_date.is_some()
        || params.end_date.is_some()
        || params.min_episodes.is_some()
        || params.max_episodes.is_some()
        || params.min_score.is_some()
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

    if let Some(min_score) = params.min_score {
        let min = min_score as f64;
        resp.data.retain(|entry| entry.node.mean.unwrap_or(0.0) >= min);
    }

    if let Some(min_ep) = params.min_episodes {
        resp.data.retain(|entry| entry.node.num_episodes.unwrap_or(0) >= min_ep);
    }

    if let Some(max_ep) = params.max_episodes {
        resp.data.retain(|entry| {
            let eps = entry.node.num_episodes.unwrap_or(0);
            eps > 0 && eps <= max_ep
        });
    }

    if let Some(ref exclude) = params.exclude_genres {
        let ids = parse_genre_ids(exclude);
        if !ids.is_empty() {
            resp.data.retain(|entry| {
                entry
                    .node
                    .genres
                    .as_ref()
                    .map(|gs| !ids.iter().any(|id| gs.iter().any(|g| g.id == *id)))
                    .unwrap_or(true)
            });
        }
    }
}

fn parse_genre_ids(genres: &str) -> Vec<u64> {
    genres
        .split(',')
        .filter_map(|s| s.trim().parse::<u64>().ok())
        .collect()
}

fn genre_id_to_name(id: u64) -> Option<&'static str> {
    GENRE_NAMES
        .iter()
        .find(|(gid, _)| *gid == id)
        .map(|(_, name)| *name)
}

const GENRE_NAMES: &[(u64, &str)] = &[
    (1, "Action"),
    (2, "Adventure"),
    (3, "Racing"),
    (4, "Comedy"),
    (5, "Avant Garde"),
    (6, "Mythology"),
    (7, "Mystery"),
    (8, "Drama"),
    (9, "Ecchi"),
    (10, "Fantasy"),
    (11, "Strategy Game"),
    (12, "Hentai"),
    (13, "Historical"),
    (14, "Horror"),
    (15, "Kids"),
    (17, "Martial Arts"),
    (18, "Mecha"),
    (19, "Music"),
    (20, "Parody"),
    (21, "Samurai"),
    (22, "Romance"),
    (23, "School"),
    (24, "Sci-Fi"),
    (25, "Shoujo"),
    (26, "Girls Love"),
    (27, "Shounen"),
    (28, "Boys Love"),
    (29, "Space"),
    (30, "Sports"),
    (31, "Super Power"),
    (32, "Vampire"),
    (35, "Harem"),
    (36, "Slice of Life"),
    (37, "Supernatural"),
    (38, "Military"),
    (39, "Detective"),
    (40, "Psychological"),
    (41, "Suspense"),
    (42, "Seinen"),
    (43, "Josei"),
    (46, "Award Winning"),
    (47, "Gourmet"),
    (48, "Workplace"),
    (49, "Erotica"),
    (50, "Adult Cast"),
    (51, "Anthropomorphic"),
    (52, "CGDCT"),
    (53, "Childcare"),
    (54, "Combat Sports"),
    (55, "Delinquents"),
    (56, "Educational"),
    (57, "Gag Humor"),
    (58, "Gore"),
    (59, "High Stakes Game"),
    (60, "Idols (Female)"),
    (61, "Idols (Male)"),
    (62, "Isekai"),
    (63, "Iyashikei"),
    (64, "Love Polygon"),
    (65, "Magical Sex Shift"),
    (66, "Mahou Shoujo"),
    (67, "Medical"),
    (68, "Organized Crime"),
    (69, "Otaku Culture"),
    (70, "Performing Arts"),
    (71, "Pets"),
    (72, "Reincarnation"),
    (73, "Reverse Harem"),
    (74, "Love Status Quo"),
    (75, "Showbiz"),
    (76, "Survival"),
    (77, "Team Sports"),
    (78, "Time Travel"),
    (79, "Video Game"),
    (80, "Visual Arts"),
    (81, "Crossdressing"),
    (82, "Urban Fantasy"),
    (83, "Villainess"),
];

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeNode {
    pub id: u64,
    pub title: String,
    #[serde(default)]
    pub main_picture: Option<Picture>,
    #[serde(default)]
    pub alternative_titles: Option<AlternativeTitles>,
    #[serde(default)]
    pub mean: Option<f64>,
    #[serde(default)]
    pub rank: Option<u32>,
    #[serde(default)]
    pub popularity: Option<u32>,
    #[serde(default)]
    pub num_episodes: Option<u32>,
    #[serde(default)]
    pub media_type: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub synopsis: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub genres: Option<Vec<Genre>>,
    #[serde(default)]
    pub my_list_status: Option<MyListStatus>,
    #[serde(default)]
    pub num_list_users: Option<u32>,
    #[serde(default)]
    pub studios: Option<Vec<Studio>>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub broadcast: Option<Broadcast>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Studio {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Broadcast {
    #[serde(default)]
    pub day_of_the_week: Option<String>,
    #[serde(default)]
    pub start_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Picture {
    pub medium: Option<String>,
    pub large: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeTitles {
    pub en: Option<String>,
    pub ja: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Genre {
    pub id: u64,
    pub name: String,
}

fn deserialize_optional_u8_from_number<'de, D>(deserializer: D) -> Result<Option<u8>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Unexpected};

    struct U8Visitor;

    impl<'de> de::Visitor<'de> for U8Visitor {
        type Value = Option<u8>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("an optional integer score")
        }

        fn visit_none<E>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            u8::try_from(value)
                .map(Some)
                .map_err(|_| de::Error::invalid_value(Unexpected::Unsigned(value), &self))
        }

        fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            if value < 0 {
                return Err(de::Error::invalid_value(
                    Unexpected::Signed(value),
                    &self,
                ));
            }
            self.visit_u64(value as u64)
        }

        fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            if !value.is_finite() || value < 0.0 {
                return Err(de::Error::invalid_value(
                    Unexpected::Float(value),
                    &self,
                ));
            }
            Ok(Some(value.round() as u8))
        }
    }

    deserializer.deserialize_any(U8Visitor)
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MyListStatus {
    pub status: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_u8_from_number")]
    pub score: Option<u8>,
    pub num_episodes_watched: Option<u32>,
    #[serde(default)]
    pub is_rewatching: Option<bool>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub finish_date: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub priority: Option<u8>,
    #[serde(default)]
    pub num_times_rewatched: Option<u32>,
    #[serde(default)]
    pub rewatch_value: Option<u8>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub comments: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeListEntry {
    pub node: AnimeNode,
    pub list_status: Option<MyListStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paging {
    pub previous: Option<String>,
    pub next: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeListResponse {
    pub data: Vec<AnimeListEntry>,
    pub paging: Option<Paging>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeSearchResponse {
    pub data: Vec<AnimeSearchNode>,
    pub paging: Option<Paging>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeSearchNode {
    pub node: AnimeNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeStatistics {
    pub num_items_watching: Option<u32>,
    pub num_items_completed: Option<u32>,
    pub num_items_on_hold: Option<u32>,
    pub num_items_dropped: Option<u32>,
    pub num_items_plan_to_watch: Option<u32>,
    pub num_items: Option<u32>,
    pub num_days: Option<f64>,
    pub num_episodes: Option<u32>,
    pub mean_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: u64,
    pub name: String,
    #[serde(default)]
    pub picture: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub birthday: Option<String>,
    #[serde(default)]
    pub time_zone: Option<String>,
    #[serde(default)]
    pub about: Option<String>,
    #[serde(default)]
    pub anime_statistics: Option<AnimeStatistics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserProfileRequest {
    pub gender: Option<String>,
    pub location: Option<String>,
    pub birthday: Option<String>,
    pub time_zone: Option<String>,
    pub about: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiringCalendarEntry {
    pub anime_id: u64,
    pub title: String,
    #[serde(default)]
    pub main_picture: Option<Picture>,
    #[serde(default)]
    pub num_episodes: Option<u32>,
    #[serde(default)]
    pub num_episodes_watched: Option<u32>,
    #[serde(default)]
    pub list_status: String,
    pub broadcast_day: String,
    #[serde(default)]
    pub broadcast_time: Option<String>,
    #[serde(default)]
    pub next_episode: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeFeed {
    pub suggestions: Vec<AnimeNode>,
    pub continue_watching: Vec<AnimeListEntry>,
    pub seasonal: Vec<AnimeNode>,
    pub airing_ranking: Vec<AnimeNode>,
    pub airing_today: Vec<AiringCalendarEntry>,
    #[serde(default)]
    pub new_episode_ids: Vec<u64>,
    pub season_year: u32,
    pub season_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimelistLoadProgress {
    pub loaded: u32,
    #[serde(default)]
    pub total: Option<u32>,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub data: T,
    #[serde(default)]
    pub from_cache: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_expires_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateListStatusRequest {
    pub status: Option<String>,
    pub score: Option<u8>,
    pub num_watched_episodes: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchAnimeParams {
    pub query: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub genres: Option<String>,
    pub media_type: Option<String>,
    pub status: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub min_score: Option<u8>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub exclude_genres: Option<String>,
    pub min_episodes: Option<u32>,
    pub max_episodes: Option<u32>,
}

pub const ANIME_FIELDS: &str = "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_list_users,media_type,status,genres,my_list_status,num_episodes,studios,source,broadcast{day_of_the_week,start_time}";

pub const HOME_CARD_FIELDS: &str =
    "id,title,main_picture,mean,media_type,status,num_episodes,start_date";

pub const ANIME_CARD_FIELDS: &str =
    "id,title,main_picture,mean,rank,media_type,status,num_episodes,start_date,genres";

pub const LIST_NODE_FIELDS: &str =
    "list_status{status,score,num_episodes_watched,start_date},num_episodes,main_picture,mean,status,genres,alternative_titles{en}";

pub const USER_FIELDS: &str = "anime_statistics{num_items_watching,num_items_completed,num_items_on_hold,num_items_dropped,num_items_plan_to_watch,num_items,num_days,num_episodes,mean_score},gender,location,birthday,time_zone,about";

#[cfg(test)]
mod tests {
    use super::MyListStatus;

    #[test]
    fn parses_mal_update_list_status_response() {
        let body = r#"{"status":"completed","score":8,"num_episodes_watched":24,"is_rewatching":false,"updated_at":"2021-01-29T18:25:23+00:00","start_date":"2021-01-29","finish_date":"2021-01-29","priority":2,"num_times_rewatched":0,"rewatch_value":5,"tags":["ignore","tags"],"comments":"ignore comments"}"#;
        let status: MyListStatus = serde_json::from_str(body).unwrap();
        assert_eq!(status.status.as_deref(), Some("completed"));
        assert_eq!(status.score, Some(8));
        assert_eq!(status.num_episodes_watched, Some(24));
    }

    #[test]
    fn parses_float_score_from_mal_response() {
        let body = r#"{"status":"completed","score":8.0,"num_episodes_watched":24}"#;
        let status: MyListStatus = serde_json::from_str(body).unwrap();
        assert_eq!(status.score, Some(8));
    }
}

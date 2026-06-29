use chrono::{Datelike, Local};

use super::calendar::{airing_today, build_airing_calendar_from_list, continue_watching_entries, has_new_episode};
use super::client::MalClient;
use super::suggestions::compute_suggestions_from_list;
use super::types::{AnimeListEntry, AnimeNode, AnimeSearchResponse, HomeFeed};
use super::client::MalError;
use crate::cache::DataCache;

const SEASONAL_LIMIT: u32 = 12;
const AIRING_RANK_LIMIT: u32 = 12;

pub async fn build_home_feed(
    cache: &DataCache,
    token: &str,
    list: &[AnimeListEntry],
) -> Result<HomeFeed, MalError> {
    let (year, season) = current_season();

    let suggestions = compute_suggestions_from_list(token, list).await?;
    let continue_watching = continue_watching_entries(
        list.iter()
            .filter(|e| {
                e.list_status
                    .as_ref()
                    .and_then(|s| s.status.as_deref())
                    == Some("watching")
            })
            .cloned()
            .collect(),
    );

    let calendar = build_airing_calendar_from_list(cache, token, list).await?;
    let airing_today_entries = airing_today(&calendar);
    let new_episode_ids: Vec<u64> = calendar
        .iter()
        .filter(|entry| has_new_episode(entry))
        .map(|entry| entry.anime_id)
        .collect();

    let seasonal_resp =
        MalClient::get_seasonal_anime(token, year, &season, SEASONAL_LIMIT, 0).await?;
    let airing_resp =
        MalClient::get_anime_ranking(token, "airing", AIRING_RANK_LIMIT, 0).await?;

    Ok(HomeFeed {
        suggestions,
        continue_watching,
        seasonal: nodes_from_search(seasonal_resp),
        airing_ranking: nodes_from_search(airing_resp),
        airing_today: airing_today_entries,
        new_episode_ids,
        season_year: year,
        season_name: season,
    })
}

fn nodes_from_search(resp: AnimeSearchResponse) -> Vec<AnimeNode> {
    resp.data.into_iter().map(|d| d.node).collect()
}

fn current_season() -> (u32, String) {
    let now = Local::now();
    let month = now.month();
    let season = match month {
        1..=3 => "winter",
        4..=6 => "spring",
        7..=9 => "summer",
        _ => "fall",
    };
    (now.year() as u32, season.to_string())
}

use std::collections::HashSet;

use chrono::{Datelike, Local, Weekday};

use super::client::{MalClient, MalError};
use super::types::{AiringCalendarEntry, AnimeListEntry, AnimeNode, MyListStatus};
use crate::cache::DataCache;

pub const CALENDAR_LIST_STATUSES: &[&str] = &["watching", "plan_to_watch", "on_hold"];

const DETAIL_CACHE_TTL_SECS: i64 = 300;

pub async fn build_airing_calendar(
    cache: &DataCache,
    token: &str,
    list_entries: Option<Vec<AnimeListEntry>>,
) -> Result<Vec<AiringCalendarEntry>, MalError> {
    let list = match list_entries {
        Some(entries) => entries,
        None => fetch_calendar_list_entries(token).await?,
    };
    build_airing_calendar_from_list(cache, token, &list).await
}

pub async fn build_airing_calendar_from_list(
    cache: &DataCache,
    token: &str,
    list: &[AnimeListEntry],
) -> Result<Vec<AiringCalendarEntry>, MalError> {
    let candidates = filter_calendar_list_entries(list);
    let mut results = Vec::with_capacity(candidates.len());

    for entry in candidates {
        if let Ok(detail) = get_anime_details_cached(cache, token, entry.node.id).await {
            if let Some(calendar_entry) = entry_to_calendar(entry, detail) {
                results.push(calendar_entry);
            }
        }
    }

    sort_calendar(&mut results);
    Ok(results)
}

pub fn filter_calendar_list_entries(list: &[AnimeListEntry]) -> Vec<AnimeListEntry> {
    list.iter()
        .filter(|entry| {
            entry
                .list_status
                .as_ref()
                .and_then(|s| s.status.as_deref())
                .map(|s| CALENDAR_LIST_STATUSES.contains(&s))
                .unwrap_or(false)
        })
        .filter(|entry| entry.node.status.as_deref() == Some("currently_airing"))
        .cloned()
        .collect()
}

pub async fn fetch_calendar_list_entries(token: &str) -> Result<Vec<AnimeListEntry>, MalError> {
    let (watching, plan_to_watch, on_hold) = tokio::try_join!(
        MalClient::fetch_all_user_animelist_with_status(token, Some("watching")),
        MalClient::fetch_all_user_animelist_with_status(token, Some("plan_to_watch")),
        MalClient::fetch_all_user_animelist_with_status(token, Some("on_hold")),
    )?;

    let mut seen = HashSet::new();
    let mut merged = Vec::new();
    for entry in watching
        .into_iter()
        .chain(plan_to_watch)
        .chain(on_hold)
    {
        if seen.insert(entry.node.id) {
            merged.push(entry);
        }
    }
    Ok(merged)
}

pub fn airing_today(entries: &[AiringCalendarEntry]) -> Vec<AiringCalendarEntry> {
    let today = Local::now().weekday();
    entries
        .iter()
        .filter(|entry| weekday_from_str(&entry.broadcast_day) == Some(today))
        .cloned()
        .collect()
}

async fn get_anime_details_cached(
    cache: &DataCache,
    token: &str,
    id: u64,
) -> Result<AnimeNode, MalError> {
    let key = format!("anime_detail_{id}");
    if let Some(cached) = cache.get_if_fresh::<AnimeNode>(&key, DETAIL_CACHE_TTL_SECS) {
        return Ok(cached);
    }
    let detail = MalClient::get_anime_details(token, id).await?;
    let _ = cache.set(&key, &detail);
    Ok(detail)
}

fn entry_to_calendar(entry: AnimeListEntry, detail: AnimeNode) -> Option<AiringCalendarEntry> {
    let broadcast = detail.broadcast?;
    let day = broadcast.day_of_the_week?;
    if day.is_empty() {
        return None;
    }

    let list_status = entry.list_status.or(detail.my_list_status);
    let list_status_str = list_status
        .as_ref()
        .and_then(|s| s.status.clone())
        .unwrap_or_default();

    Some(AiringCalendarEntry {
        anime_id: detail.id,
        title: detail.title,
        main_picture: detail.main_picture,
        num_episodes: detail.num_episodes,
        num_episodes_watched: list_status
            .as_ref()
            .and_then(|s| s.num_episodes_watched),
        list_status: list_status_str,
        broadcast_day: day,
        broadcast_time: broadcast.start_time,
        next_episode: next_episode_number(list_status.as_ref(), detail.num_episodes),
    })
}

pub fn next_episode_number(
    list_status: Option<&MyListStatus>,
    total: Option<u32>,
) -> Option<u32> {
    let list_status = list_status?;
    let status = list_status.status.as_deref().unwrap_or("");
    let watched = list_status.num_episodes_watched.unwrap_or(0);

    let next = if watched == 0 && status == "plan_to_watch" {
        1
    } else if watched == 0 {
        return None;
    } else {
        watched + 1
    };

    if let Some(total) = total {
        if total > 0 && next > total {
            return None;
        }
    }
    Some(next)
}

fn sort_calendar(entries: &mut [AiringCalendarEntry]) {
    entries.sort_by(|a, b| {
        day_order(&a.broadcast_day)
            .cmp(&day_order(&b.broadcast_day))
            .then_with(|| time_key(&a.broadcast_time).cmp(&time_key(&b.broadcast_time)))
            .then_with(|| a.title.cmp(&b.title))
    });
}

fn day_order(day: &str) -> u8 {
    match day.to_lowercase().as_str() {
        "monday" | "mon" => 0,
        "tuesday" | "tue" => 1,
        "wednesday" | "wed" => 2,
        "thursday" | "thu" => 3,
        "friday" | "fri" => 4,
        "saturday" | "sat" => 5,
        "sunday" | "sun" => 6,
        other if !other.is_empty() => 7,
        _ => 8,
    }
}

fn weekday_from_str(day: &str) -> Option<Weekday> {
    match day.to_lowercase().as_str() {
        "monday" | "mon" => Some(Weekday::Mon),
        "tuesday" | "tue" => Some(Weekday::Tue),
        "wednesday" | "wed" => Some(Weekday::Wed),
        "thursday" | "thu" => Some(Weekday::Thu),
        "friday" | "fri" => Some(Weekday::Fri),
        "saturday" | "sat" => Some(Weekday::Sat),
        "sunday" | "sun" => Some(Weekday::Sun),
        _ => None,
    }
}

fn time_key(time: &Option<String>) -> String {
    time.as_deref().unwrap_or("99:99").to_string()
}

pub fn continue_watching_entries(entries: Vec<AnimeListEntry>) -> Vec<AnimeListEntry> {
    let mut filtered: Vec<AnimeListEntry> = entries
        .into_iter()
        .filter(|entry| {
            let watched = entry
                .list_status
                .as_ref()
                .and_then(|s| s.num_episodes_watched)
                .unwrap_or(0);
            if watched == 0 {
                return false;
            }
            let total = entry.node.num_episodes.unwrap_or(0);
            total == 0 || watched < total
        })
        .collect();

    filtered.sort_by(|a, b| {
        let progress = |entry: &AnimeListEntry| {
            let watched = entry
                .list_status
                .as_ref()
                .and_then(|s| s.num_episodes_watched)
                .unwrap_or(0) as f64;
            let total = entry.node.num_episodes.unwrap_or(0).max(1) as f64;
            watched / total
        };
        progress(b)
            .partial_cmp(&progress(a))
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.node.title.cmp(&b.node.title))
    });

    filtered.truncate(12);
    filtered
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry_with_status(status: &str, watched: u32) -> AnimeListEntry {
        AnimeListEntry {
            node: AnimeNode {
                id: 1,
                title: "Test".into(),
                main_picture: None,
                alternative_titles: None,
                mean: None,
                rank: None,
                popularity: None,
                num_episodes: None,
                media_type: None,
                status: Some("currently_airing".into()),
                synopsis: None,
                start_date: None,
                end_date: None,
                genres: None,
                my_list_status: None,
                num_list_users: None,
                studios: None,
                source: None,
                broadcast: None,
            },
            list_status: Some(MyListStatus {
                status: Some(status.into()),
                score: None,
                num_episodes_watched: Some(watched),
                is_rewatching: None,
                start_date: None,
                finish_date: None,
            }),
        }
    }

    #[test]
    fn filter_calendar_list_entries_includes_three_statuses() {
        let list = vec![
            entry_with_status("watching", 2),
            entry_with_status("plan_to_watch", 0),
            entry_with_status("on_hold", 1),
            entry_with_status("completed", 12),
        ];
        let filtered = filter_calendar_list_entries(&list);
        assert_eq!(filtered.len(), 3);
    }

    #[test]
    fn next_episode_plan_to_watch_starts_at_one() {
        let ls = MyListStatus {
            status: Some("plan_to_watch".into()),
            score: None,
            num_episodes_watched: Some(0),
            is_rewatching: None,
            start_date: None,
            finish_date: None,
        };
        assert_eq!(next_episode_number(Some(&ls), Some(12)), Some(1));
    }

    #[test]
    fn next_episode_watching_requires_progress() {
        let ls = MyListStatus {
            status: Some("watching".into()),
            score: None,
            num_episodes_watched: Some(0),
            is_rewatching: None,
            start_date: None,
            finish_date: None,
        };
        assert_eq!(next_episode_number(Some(&ls), Some(12)), None);
    }
}

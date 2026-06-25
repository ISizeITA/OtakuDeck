use super::client::{MalClient, MalError};
use super::types::{AiringCalendarEntry, AnimeListEntry, AnimeNode, MyListStatus};

pub async fn build_airing_calendar(token: &str) -> Result<Vec<AiringCalendarEntry>, MalError> {
    let watching = MalClient::fetch_all_user_animelist_with_status(token, Some("watching")).await?;
    let airing: Vec<AnimeListEntry> = watching
        .into_iter()
        .filter(|entry| entry.node.status.as_deref() == Some("currently_airing"))
        .collect();

    let mut results = Vec::with_capacity(airing.len());
    for entry in airing {
        if let Ok(detail) = MalClient::get_anime_details(token, entry.node.id).await {
            if let Some(calendar_entry) = entry_to_calendar(entry, detail) {
                results.push(calendar_entry);
            }
        }
    }

    sort_calendar(&mut results);
    Ok(results)
}

fn entry_to_calendar(entry: AnimeListEntry, detail: AnimeNode) -> Option<AiringCalendarEntry> {
    let broadcast = detail.broadcast?;
    let day = broadcast.day_of_the_week?;
    if day.is_empty() {
        return None;
    }

    let list_status = entry.list_status.or(detail.my_list_status);
    Some(AiringCalendarEntry {
        anime_id: detail.id,
        title: detail.title,
        main_picture: detail.main_picture,
        num_episodes: detail.num_episodes,
        num_episodes_watched: list_status
            .as_ref()
            .and_then(|s| s.num_episodes_watched),
        broadcast_day: day,
        broadcast_time: broadcast.start_time,
        next_episode: next_episode_number(list_status.as_ref(), detail.num_episodes),
    })
}

fn next_episode_number(list_status: Option<&MyListStatus>, total: Option<u32>) -> Option<u32> {
    let watched = list_status?.num_episodes_watched?;
    let next = watched + 1;
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

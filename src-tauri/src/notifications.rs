use std::sync::Mutex;

use chrono::{Datelike, Duration, Local, NaiveTime, Weekday};
use tauri::AppHandle;
use tauri_plugin_notification::{NotificationExt, Schedule};
use time::OffsetDateTime;

use crate::mal::types::AiringCalendarEntry;
use crate::preferences::AppPreferences;

static SCHEDULED_IDS: Mutex<Vec<i32>> = Mutex::new(Vec::new());

pub fn sync_episode_notifications(
    app: &AppHandle,
    prefs: &AppPreferences,
    entries: &[AiringCalendarEntry],
) -> Result<(), String> {
    cancel_scheduled(app);

    if !prefs.episode_notifications {
        return Ok(());
    }

    let mut ids = Vec::new();

    for entry in entries {
        let Some(at) = next_notification_time(&entry.broadcast_day, entry.broadcast_time.as_deref())
        else {
            continue;
        };

        let id = entry.anime_id.min(i32::MAX as u64) as i32;
        let episode_label = entry
            .next_episode
            .map(|n| format!("Ep. {n}"))
            .unwrap_or_else(|| "Nuovo episodio".to_string());
        let body = format!("{episode_label} — {}", entry.title);

        app.notification()
            .builder()
            .id(id)
            .title("OtakuDeck")
            .body(body)
            .schedule(Schedule::At {
                date: at,
                repeating: false,
                allow_while_idle: true,
            })
            .show()
            .map_err(|e| e.to_string())?;

        ids.push(id);
    }

    if let Ok(mut guard) = SCHEDULED_IDS.lock() {
        *guard = ids;
    }

    Ok(())
}

fn cancel_scheduled(_app: &AppHandle) {
    if let Ok(mut guard) = SCHEDULED_IDS.lock() {
        guard.clear();
    }
}

fn next_notification_time(day: &str, time: Option<&str>) -> Option<OffsetDateTime> {
    let weekday = parse_weekday(day)?;
    let now = Local::now();
    let mut date = now.date_naive();

    for _ in 0..8 {
        if date.weekday() == weekday {
            let dt = apply_broadcast_time(date, time)?;
            if dt > now {
                return Some(to_offset(dt));
            }
        }
        date += Duration::days(1);
    }

    None
}

fn parse_weekday(day: &str) -> Option<Weekday> {
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

fn apply_broadcast_time(
    date: chrono::NaiveDate,
    broadcast: Option<&str>,
) -> Option<chrono::DateTime<Local>> {
    let (hour, minute) = parse_hh_mm(broadcast.unwrap_or("18:00"))?;
    let time = NaiveTime::from_hms_opt(hour.into(), minute.into(), 0)?;
    date.and_time(time).and_local_timezone(Local).single()
}

fn parse_hh_mm(value: &str) -> Option<(u32, u32)> {
    let mut parts = value.split(':');
    let hour: u32 = parts.next()?.parse().ok()?;
    let minute: u32 = parts.next()?.parse().ok()?;
    Some((hour, minute))
}

fn to_offset(dt: chrono::DateTime<Local>) -> OffsetDateTime {
    OffsetDateTime::from_unix_timestamp(dt.timestamp()).unwrap_or_else(|_| OffsetDateTime::now_utc())
}

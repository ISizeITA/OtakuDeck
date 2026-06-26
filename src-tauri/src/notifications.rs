use std::sync::Mutex;

use chrono::Weekday;
use tauri::AppHandle;
use tauri_plugin_notification::{NotificationExt, Schedule, ScheduleInterval};

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
        let Some(weekday) = parse_weekday(&entry.broadcast_day) else {
            continue;
        };
        let (hour, minute) = parse_hh_mm(entry.broadcast_time.as_deref().unwrap_or("18:00"))
            .unwrap_or((18, 0));

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
            .schedule(Schedule::Interval {
                interval: ScheduleInterval {
                    weekday: Some(weekday_to_calendar(weekday)),
                    hour: Some(hour as u8),
                    minute: Some(minute as u8),
                    ..Default::default()
                },
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

fn weekday_to_calendar(weekday: Weekday) -> u8 {
    match weekday {
        Weekday::Sun => 1,
        Weekday::Mon => 2,
        Weekday::Tue => 3,
        Weekday::Wed => 4,
        Weekday::Thu => 5,
        Weekday::Fri => 6,
        Weekday::Sat => 7,
    }
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

fn parse_hh_mm(value: &str) -> Option<(u32, u32)> {
    let mut parts = value.split(':');
    let hour: u32 = parts.next()?.parse().ok()?;
    let minute: u32 = parts.next()?.parse().ok()?;
    Some((hour, minute))
}

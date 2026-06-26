use std::sync::Mutex;

use chrono::Weekday;
use tauri::AppHandle;
use tauri_plugin_notification::{NotificationExt, Schedule, ScheduleInterval};

use crate::mal::types::AiringCalendarEntry;
use crate::preferences::AppPreferences;

static SCHEDULED_IDS: Mutex<Vec<i32>> = Mutex::new(Vec::new());

const REMINDER_ID_OFFSET: i32 = 1_000_000_000;

pub fn sync_episode_notifications(
    app: &AppHandle,
    prefs: &AppPreferences,
    entries: &[AiringCalendarEntry],
) -> Result<(), String> {
    cancel_scheduled(app);

    if !prefs.episode_notifications {
        return Ok(());
    }

    let reminder_minutes = prefs.episode_reminder_minutes.max(1).min(120);
    let mut ids = Vec::new();

    for entry in entries {
        let Some(weekday) = parse_weekday(&entry.broadcast_day) else {
            continue;
        };
        let (hour, minute) = parse_hh_mm(entry.broadcast_time.as_deref().unwrap_or("18:00"))
            .unwrap_or((18, 0));

        let episode_label = entry
            .next_episode
            .map(|n| format!("Ep. {n}"))
            .unwrap_or_else(|| "Nuovo episodio".to_string());

        let base_id = entry.anime_id.min(i32::MAX as u64) as i32;

        schedule_weekly(
            app,
            base_id,
            "OtakuDeck",
            &format!("{episode_label} — {}", entry.title),
            weekday,
            hour,
            minute,
        )?;
        ids.push(base_id);

        let (rem_hour, rem_minute) = subtract_minutes(hour, minute, reminder_minutes);
        let reminder_id = base_id.wrapping_add(REMINDER_ID_OFFSET);
        schedule_weekly(
            app,
            reminder_id,
            "OtakuDeck",
            &format!("Tra {reminder_minutes} min: {episode_label} — {}", entry.title),
            weekday,
            rem_hour,
            rem_minute,
        )?;
        ids.push(reminder_id);
    }

    if let Ok(mut guard) = SCHEDULED_IDS.lock() {
        *guard = ids;
    }

    Ok(())
}

fn schedule_weekly(
    app: &AppHandle,
    id: i32,
    title: &str,
    body: &str,
    weekday: Weekday,
    hour: u32,
    minute: u32,
) -> Result<(), String> {
    app.notification()
        .builder()
        .id(id)
        .title(title)
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
        .map_err(|e| e.to_string())
}

fn subtract_minutes(hour: u32, minute: u32, delta: u32) -> (u32, u32) {
    let total = hour * 60 + minute;
    let adjusted = (total + 24 * 60 - delta) % (24 * 60);
    (adjusted / 60, adjusted % 60)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subtract_minutes_wraps_day() {
        assert_eq!(subtract_minutes(18, 0, 30), (17, 30));
        assert_eq!(subtract_minutes(0, 15, 30), (23, 45));
    }
}

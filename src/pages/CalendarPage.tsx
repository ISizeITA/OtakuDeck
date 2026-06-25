import { useCallback, useEffect, useMemo, useState } from "react";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useRefresh } from "@/context/RefreshContext";
import { useTranslation } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import { cacheExpiryFromResponse } from "@/lib/cacheExpiry";
import "@/styles/components/calendar.css";
import type { AiringCalendarEntry } from "@/types/mal";
import { getCoverUrl } from "@/types/mal";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function dayIndex(day: string): number {
  const idx = DAY_ORDER.indexOf(day.toLowerCase());
  return idx === -1 ? 99 : idx;
}

export function CalendarPage() {
  const { t } = useTranslation();
  const { openAnime } = useAnimeModal();
  const { refreshKey } = useRefresh();
  const [entries, setEntries] = useState<AiringCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.getAiringCalendar();
      setEntries(resp.data);
      setOffline(resp.from_cache);
      setCacheExpiresAt(
        cacheExpiryFromResponse(resp.from_cache, resp.cache_expires_at),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, AiringCalendarEntry[]>();
    for (const entry of entries) {
      const key = entry.broadcast_day.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()].sort(
      ([a], [b]) => dayIndex(a) - dayIndex(b),
    );
  }, [entries]);

  const dayLabel = (day: string) => {
    const key = day.toLowerCase();
    const translationKey = `calendar.day.${key}` as const;
    const translated = t(translationKey as "calendar.title");
    return translated.startsWith("calendar.day.") ? day : translated;
  };

  if (loading && entries.length === 0) {
    return (
      <div className="page page--centered">
        <span className="pill-button__spinner page__spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <OfflineBanner visible={offline} expiresAt={cacheExpiresAt} />
      {error && <p className="page__error">{error}</p>}

      <header className="calendar-header">
        <h2 className="calendar-header__title">{t("calendar.title")}</h2>
        <p className="calendar-header__subtitle">{t("calendar.subtitle")}</p>
      </header>

      {grouped.length === 0 ? (
        <p className="calendar-empty">{t("calendar.empty")}</p>
      ) : (
        grouped.map(([day, items]) => (
          <section key={day} className="calendar-day">
            <h3 className="calendar-day__title">{dayLabel(day)}</h3>
            <ul className="calendar-day__list">
              {items.map((entry) => (
                <li key={entry.anime_id}>
                  <button
                    type="button"
                    className="calendar-item"
                    onClick={() =>
                      openAnime({
                        id: entry.anime_id,
                        title: entry.title,
                        main_picture: entry.main_picture,
                        num_episodes: entry.num_episodes,
                      })
                    }
                  >
                    <img
                      className="calendar-item__cover"
                      src={getCoverUrl({
                        id: entry.anime_id,
                        title: entry.title,
                        main_picture: entry.main_picture,
                      })}
                      alt=""
                    />
                    <div className="calendar-item__body">
                      <span className="calendar-item__title">{entry.title}</span>
                      <span className="calendar-item__meta">
                        {entry.broadcast_time && (
                          <span>{entry.broadcast_time}</span>
                        )}
                        {entry.next_episode !== undefined && (
                          <span>
                            {t("calendar.nextEpisode", {
                              episode: entry.next_episode,
                            })}
                          </span>
                        )}
                        {entry.num_episodes_watched !== undefined &&
                          entry.num_episodes !== undefined &&
                          entry.num_episodes > 0 && (
                            <span>
                              {t("common.episodesWatched", {
                                watched: entry.num_episodes_watched,
                                total: entry.num_episodes,
                              })}
                            </span>
                          )}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

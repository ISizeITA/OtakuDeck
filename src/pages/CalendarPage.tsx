import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { CacheStatusBar } from "@/components/CacheStatusBar";
import { FilterChips } from "@/components/FilterChips";
import { NewEpisodeBadge } from "@/components/NewEpisodeBadge";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TabPills } from "@/components/TabPills";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useRefresh } from "@/context/RefreshContext";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import { getLocalDayKey, formatBroadcastDisplay, isBroadcastDayToday } from "@/lib/broadcastTime";
import { cacheExpiryFromResponse } from "@/lib/cacheExpiry";
import { hasNewEpisodeFromCalendar } from "@/lib/newEpisode";
import "@/styles/components/calendar.css";
import type { AiringCalendarEntry, AnimeNode, ListStatus } from "@/types/mal";
import { getCoverUrl, getCurrentSeason } from "@/types/mal";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type CalendarView = "schedule" | "season";
type CalendarStatusFilter = Extract<ListStatus, "watching" | "plan_to_watch" | "on_hold">;

const STATUS_FILTERS: CalendarStatusFilter[] = [
  "watching",
  "plan_to_watch",
  "on_hold",
];

function dayIndex(day: string): number {
  const idx = DAY_ORDER.indexOf(day.toLowerCase());
  return idx === -1 ? 99 : idx;
}

export function CalendarPage() {
  const { t, locale } = useTranslation();
  const { listStatus } = useMalLabels();
  const { openAnime } = useAnimeModal();
  const { refreshKey, isRefreshing } = useRefresh();
  const prevRefreshKey = useRef(refreshKey);
  const [view, setView] = useState<CalendarView>("schedule");
  const [statusFilters, setStatusFilters] = useState<Set<CalendarStatusFilter>>(
    () => new Set(STATUS_FILTERS),
  );
  const [entries, setEntries] = useState<AiringCalendarEntry[]>([]);
  const [seasonal, setSeasonal] = useState<AnimeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { year, season } = getCurrentSeason();
  const todayKey = useMemo(() => getLocalDayKey(), []);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.getAiringCalendar(forceRefresh);
      setEntries(resp.data);
      setOffline(resp.from_cache);
      setCachedAt(resp.cached_at ?? null);
      setCacheExpiresAt(
        cacheExpiryFromResponse(resp.from_cache, resp.cache_expires_at),
      );

      if (resp.from_cache && !forceRefresh) {
        void api
          .getAiringCalendar(true)
          .then((fresh) => {
            setEntries(fresh.data);
            setOffline(fresh.from_cache);
            setCachedAt(fresh.cached_at ?? null);
            setCacheExpiresAt(
              cacheExpiryFromResponse(fresh.from_cache, fresh.cache_expires_at),
            );
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const forceRefresh = refreshKey > prevRefreshKey.current;
    prevRefreshKey.current = refreshKey;
    void load(forceRefresh);
  }, [load, refreshKey]);

  useEffect(() => {
    if (view !== "season") return;
    let cancelled = false;
    void api
      .getSeasonalAnime(year, season, 24, 0)
      .then((resp) => {
        if (!cancelled) setSeasonal(resp.data.data.map((d) => d.node));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [view, year, season]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const status = (entry.list_status ?? "watching") as CalendarStatusFilter;
        return statusFilters.has(status);
      }),
    [entries, statusFilters],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AiringCalendarEntry[]>();
    for (const entry of filteredEntries) {
      const key = entry.broadcast_day.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => dayIndex(a) - dayIndex(b));
  }, [filteredEntries]);

  const dayLabel = (day: string) => {
    const key = day.toLowerCase();
    const translationKey = `calendar.day.${key}` as const;
    const translated = t(translationKey as "calendar.title");
    return translated.startsWith("calendar.day.") ? day : translated;
  };

  const statusFilterChips = useMemo(
    () =>
      STATUS_FILTERS.map((id) => ({
        id,
        label: listStatus(id),
      })),
    [listStatus],
  );

  const toggleStatusFilter = (id: string) => {
    const status = id as CalendarStatusFilter;
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size === 1) return prev;
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const viewTabs = useMemo(
    () => [
      { id: "schedule" as const, label: t("calendar.viewSchedule") },
      { id: "season" as const, label: t("calendar.viewSeason") },
    ],
    [t],
  );

  if (loading && entries.length === 0 && view === "schedule") {
    return (
      <div className="page page--centered">
        <span className="pill-button__spinner page__spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <CacheStatusBar
        fromCache={offline}
        cachedAt={cachedAt}
        cacheExpiresAt={cacheExpiresAt}
        loading={isRefreshing || (loading && entries.length > 0)}
      />
      <OfflineBanner visible={offline} expiresAt={cacheExpiresAt} />
      {error && <p className="page__error">{error}</p>}

      <header className="calendar-header">
        <h2 className="calendar-header__title">{t("calendar.title")}</h2>
        <p className="calendar-header__subtitle">{t("calendar.subtitle")}</p>
      </header>

      <TabPills
        tabs={viewTabs}
        activeId={view}
        onChange={(id) => setView(id as CalendarView)}
      />

      {view === "schedule" && (
        <>
          <FilterChips
            label={t("calendar.filterStatus")}
            chips={statusFilterChips}
            activeId=""
            multi
            activeIds={[...statusFilters]}
            onChange={toggleStatusFilter}
          />

          {grouped.length === 0 ? (
            <p className="calendar-empty">{t("calendar.empty")}</p>
          ) : (
            grouped.map(([day, items]) => (
              <section
                key={day}
                className={`calendar-day ${day.toLowerCase() === todayKey ? "calendar-day--today" : ""}`}
              >
                <h3 className="calendar-day__title">
                  {dayLabel(day)}
                  {day.toLowerCase() === todayKey && (
                    <span className="calendar-day__today-badge">{t("calendar.today")}</span>
                  )}
                </h3>
                <ul className="calendar-day__list">
                  {items.map((entry) => (
                    <li key={entry.anime_id}>
                      <button
                        type="button"
                        className={`calendar-item ${isBroadcastDayToday(entry.broadcast_day) ? "calendar-item--today" : ""}`}
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
                          <span className="calendar-item__title-row">
                            <span className="calendar-item__title">
                              {entry.title}
                            </span>
                            {entry.list_status && (
                              <span
                                className={`calendar-item__badge calendar-item__badge--${entry.list_status}`}
                              >
                                {listStatus(entry.list_status as ListStatus)}
                              </span>
                            )}
                            {hasNewEpisodeFromCalendar(entry) && <NewEpisodeBadge />}
                          </span>
                          <span className="calendar-item__meta">
                            {entry.broadcast_time && (
                              <span>
                                {formatBroadcastDisplay(entry.broadcast_time, locale)}
                              </span>
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
        </>
      )}

      {view === "season" && (
        <section className="page__section">
          <AnimeGrid
            anime={seasonal}
            emptyMessage={t("calendar.seasonEmpty")}
          />
        </section>
      )}
    </div>
  );
}

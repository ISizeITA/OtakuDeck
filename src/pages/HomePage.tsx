import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { AnimeGrid } from "@/components/AnimeGrid";
import { CacheStatusBar } from "@/components/CacheStatusBar";
import { NewEpisodeBadge } from "@/components/NewEpisodeBadge";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useRefresh } from "@/context/RefreshContext";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { cacheExpiryFromResponse } from "@/lib/cacheExpiry";
import { RecentSection } from "@/components/RecentSection";
import { formatBroadcastDisplay, formatBroadcastLocal } from "@/lib/broadcastTime";
import { buildNewEpisodeIdSet, hasNewEpisodeFromCalendar } from "@/lib/newEpisode";
import "@/styles/components/page.css";
import {
  getCoverUrl,
  type AiringCalendarEntry,
  type AnimeListEntry,
  type AnimeNode,
  type ApiResponse,
  type HomeFeed,
} from "@/types/mal";

function entryToNode(entry: AnimeListEntry): AnimeNode {
  return {
    ...entry.node,
    my_list_status: entry.list_status,
  };
}

function renderAiringTime(time: string | undefined, locale: string) {
  const localTime = formatBroadcastLocal(time);
  if (!localTime) return formatBroadcastDisplay(time, locale);
  const label = locale.startsWith("it") ? "ora locale" : "local";
  return (
    <>
      <span className="home-airing-today__time">{localTime}</span>
      {` (${label})`}
    </>
  );
}

export function HomePage() {
  const { t, locale } = useTranslation();
  const { mediaType, season } = useMalLabels();
  const { refreshKey, isRefreshing } = useRefresh();
  const prevRefreshKey = useRef(refreshKey);
  const { openAnime } = useAnimeModal();
  const [newEpisodeIds, setNewEpisodeIds] = useState<Set<number>>(() => new Set());
  const [suggestions, setSuggestions] = useState<AnimeNode[]>([]);
  const [continueWatching, setContinueWatching] = useState<AnimeNode[]>([]);
  const [seasonal, setSeasonal] = useState<AnimeNode[]>([]);
  const [airing, setAiring] = useState<AnimeNode[]>([]);
  const [airingToday, setAiringToday] = useState<AiringCalendarEntry[]>([]);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [seasonName, setSeasonName] = useState("spring");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyFeed = useCallback((resp: ApiResponse<HomeFeed>) => {
    setSuggestions(resp.data.suggestions);
    setContinueWatching(resp.data.continue_watching.map(entryToNode));
    setSeasonal(resp.data.seasonal);
    setAiring(resp.data.airing_ranking);
    setAiringToday(resp.data.airing_today);
    setNewEpisodeIds(buildNewEpisodeIdSet(resp.data.new_episode_ids ?? []));
    setSeasonYear(resp.data.season_year);
    setSeasonName(resp.data.season_name);
    setOffline(resp.from_cache);
    setCachedAt(resp.cached_at ?? null);
    setCacheExpiresAt(
      cacheExpiryFromResponse(resp.from_cache, resp.cache_expires_at),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const forceRefresh = refreshKey > prevRefreshKey.current;
      prevRefreshKey.current = refreshKey;

      try {
        const resp = await api.getHomeFeed(forceRefresh);
        if (cancelled) return;
        applyFeed(resp);

        if (resp.from_cache && !forceRefresh) {
          void api
            .getHomeFeed(true)
            .then((fresh) => {
              if (!cancelled) applyFeed(fresh);
            })
            .catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyFeed, refreshKey]);

  if (loading && suggestions.length === 0 && continueWatching.length === 0) {
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
        loading={isRefreshing || (loading && continueWatching.length > 0)}
      />
      <OfflineBanner visible={offline} expiresAt={cacheExpiresAt} />
      {error && <p className="page__error">{error}</p>}

      <RecentSection />

      {airingToday.length > 0 && (
        <section className="page__section">
          <SectionHeader
            title={t("home.airingTodayTitle")}
            subtitle={t("home.airingTodaySubtitle")}
          />
          <ul className="home-airing-today">
            {airingToday.map((entry) => (
              <li key={entry.anime_id}>
                <button
                  type="button"
                  className="home-airing-today__item"
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
                    className="home-airing-today__cover"
                    src={getCoverUrl({
                      id: entry.anime_id,
                      title: entry.title,
                      main_picture: entry.main_picture,
                    })}
                    alt=""
                  />
                  <div className="home-airing-today__body">
                    <span className="home-airing-today__title">{entry.title}</span>
                    <span className="home-airing-today__meta">
                      {renderAiringTime(entry.broadcast_time, locale)}
                      {entry.next_episode !== undefined &&
                        ` · ${t("calendar.nextEpisode", { episode: entry.next_episode })}`}
                    </span>
                    {hasNewEpisodeFromCalendar(entry) && <NewEpisodeBadge />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {continueWatching.length > 0 && (
        <section className="page__section">
          <SectionHeader
            title={t("home.continueTitle")}
            subtitle={t("home.continueSubtitle")}
          />
          <AnimeGrid
            anime={continueWatching}
            newEpisodeIds={newEpisodeIds}
            subtitle={(a) => {
              const watched = a.my_list_status?.num_episodes_watched ?? 0;
              const total = a.num_episodes ?? 0;
              return total > 0
                ? t("common.episodesWatched", { watched, total })
                : t("common.episodes", { count: watched });
            }}
          />
        </section>
      )}

      <section className="page__section">
        <SectionHeader
          title={t("home.suggestionsTitle")}
          subtitle={t("home.suggestionsSubtitle")}
        />
        <AnimeGrid anime={suggestions} />
      </section>

      <section className="page__section">
        <SectionHeader
          title={t("home.seasonalTitle")}
          subtitle={t("home.seasonalSubtitle", {
            season: season(seasonName),
            year: seasonYear,
          })}
        />
        <AnimeGrid
          anime={seasonal}
          subtitle={(a) => (a.media_type ? mediaType(a.media_type) : "")}
        />
      </section>

      <section className="page__section">
        <SectionHeader
          title={t("home.airingTitle")}
          subtitle={t("home.airingSubtitle")}
        />
        <AnimeGrid
          anime={airing}
          subtitle={(a) =>
            a.start_date ? a.start_date.split("T")[0] : t("common.onAir")
          }
        />
      </section>
    </div>
  );
}

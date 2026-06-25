import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AnimeGrid } from "@/components/AnimeGrid";
import { FilterChips } from "@/components/FilterChips";
import { GenreFilterBar } from "@/components/GenreFilterBar";
import { GenrePicker } from "@/components/GenrePicker";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PillButton } from "@/components/PillButton";
import { SearchBar } from "@/components/SearchBar";
import { StatsAccordion } from "@/components/StatsAccordion";
import { TabPills } from "@/components/TabPills";
import { useTranslation } from "@/context/SettingsContext";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useRefresh } from "@/context/RefreshContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import { cacheExpiryFromResponse } from "@/lib/cacheExpiry";
import "@/styles/components/onboarding.css";
import "@/styles/components/page.css";
import type { AnimelistLoadProgress, AnimeNode, AnimeStatistics, ListTabFilter } from "@/types/mal";

const LIST_TABS: ListTabFilter[] = [
  "all",
  "watching",
  "completed",
  "plan_to_watch",
  "on_hold",
  "dropped",
];

const LIST_REFRESH_MS = 10 * 60 * 1000;

function listCountForTab(stats: AnimeStatistics, tab: ListTabFilter): number {
  switch (tab) {
    case "all":
      return stats.num_items ?? 0;
    case "watching":
      return stats.num_items_watching ?? 0;
    case "completed":
      return stats.num_items_completed ?? 0;
    case "plan_to_watch":
      return stats.num_items_plan_to_watch ?? 0;
    case "on_hold":
      return stats.num_items_on_hold ?? 0;
    case "dropped":
      return stats.num_items_dropped ?? 0;
    default:
      return 0;
  }
}

type ListSort = "title" | "date_added" | "community_score";

function sortAnimeList(
  anime: AnimeNode[],
  sort: ListSort,
  locale: string,
): AnimeNode[] {
  const copy = [...anime];
  switch (sort) {
    case "title":
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, locale, { sensitivity: "base" }),
      );
    case "date_added":
      return copy.sort((a, b) => {
        const da = a.my_list_status?.start_date ?? "";
        const db = b.my_list_status?.start_date ?? "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      });
    case "community_score":
      return copy.sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
  }
}

function filterByTab(anime: AnimeNode[], tab: ListTabFilter): AnimeNode[] {
  if (tab === "all") return anime;
  return anime.filter((entry) => entry.my_list_status?.status === tab);
}

function filterListSearch(
  anime: AnimeNode[],
  query: string,
  genreIds: string[],
): AnimeNode[] {
  let result = anime;
  const trimmed = query.trim().toLowerCase();

  if (trimmed) {
    result = result.filter((entry) => {
      const title = entry.title.toLowerCase();
      const alt = entry.alternative_titles?.en?.toLowerCase() ?? "";
      return title.includes(trimmed) || alt.includes(trimmed);
    });
  }

  if (genreIds.length > 0) {
    result = result.filter((entry) =>
      genreIds.every((id) =>
        entry.genres?.some((g) => String(g.id) === id),
      ),
    );
  }

  return result;
}

export function ListPage() {
  const { t, locale } = useTranslation();
  const { listStatus } = useMalLabels();
  const [activeTab, setActiveTab] = useState<ListTabFilter>("all");
  const [sort, setSort] = useState<ListSort>("date_added");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [anime, setAnime] = useState<AnimeNode[]>([]);
  const [stats, setStats] = useState<AnimeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<AnimelistLoadProgress | null>(
    null,
  );
  const { refreshKey: modalRefreshKey } = useAnimeModal();
  const { refreshKey: pullRefreshKey } = useRefresh();
  const loadIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const unlisten = listen<AnimelistLoadProgress>(
      "animelist-load-progress",
      (event) => setLoadProgress(event.payload),
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const tabs = useMemo(
    () =>
      LIST_TABS.map((id) => ({
        id,
        label: id === "all" ? t("list.all") : listStatus(id),
      })),
    [listStatus, t],
  );

  const filteredListCount = useMemo(
    () => (stats ? listCountForTab(stats, activeTab) : 0),
    [stats, activeTab],
  );

  const sortOptions = useMemo(
    () =>
      [
        { id: "title" as const, label: t("list.sortTitle") },
        { id: "date_added" as const, label: t("list.sortDate") },
        { id: "community_score" as const, label: t("list.sortCommunity") },
      ],
    [t],
  );

  const filteredAnime = useMemo(() => {
    const byTab = filterByTab(anime, activeTab);
    return filterListSearch(byTab, debouncedSearch, genreIds);
  }, [anime, activeTab, debouncedSearch, genreIds]);

  const sortedAnime = useMemo(
    () => sortAnimeList(filteredAnime, sort, locale),
    [filteredAnime, sort, locale],
  );

  useEffect(() => {
    api
      .getUserProfile()
      .then((p) => setStats(p.data.anime_statistics ?? null))
      .catch(() => {});
  }, [modalRefreshKey, pullRefreshKey]);

  const loadList = useCallback(
    async (forceRefresh = false) => {
      const loadId = ++loadIdRef.current;
      setLoading(true);
      setError(null);
      setLoadProgress(null);
      try {
        const resp = await api.getUserAnimelistAll(forceRefresh);
      if (loadId !== loadIdRef.current) return;

      setAnime(
        resp.data.map((e) => ({
          ...e.node,
          my_list_status: e.list_status ?? e.node.my_list_status,
        })),
      );
      setOffline(resp.from_cache);
      setCacheExpiresAt(
        cacheExpiryFromResponse(resp.from_cache, resp.cache_expires_at),
      );
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      setError(String(err));
    } finally {
      if (loadId === loadIdRef.current) {
        setLoading(false);
        setLoadProgress(null);
      }
    }
  }, [modalRefreshKey]);

  useEffect(() => {
    void loadList(false);
  }, [loadList]);

  useEffect(() => {
    if (modalRefreshKey > 0) void loadList(true);
  }, [modalRefreshKey, loadList]);

  useEffect(() => {
    if (pullRefreshKey > 0) void loadList(true);
  }, [pullRefreshKey, loadList]);

  useEffect(() => {
    const interval = setInterval(() => void loadList(false), LIST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadList]);

  const progressPercent =
    loadProgress?.total && loadProgress.total > 0
      ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))
      : null;

  return (
    <div className="page">
      <OfflineBanner visible={offline} expiresAt={cacheExpiresAt} />

      {stats && (
        <StatsAccordion stats={stats} listCount={filteredListCount} />
      )}

      <TabPills
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as ListTabFilter)}
      />

      <div className="list-toolbar" {...(genrePickerOpen ? { inert: true } : {})}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("list.searchPlaceholder")}
        />
        <GenreFilterBar
          labelKey="list.genres"
          selectedIds={genreIds}
          onOpenPicker={() => {
            (document.activeElement as HTMLElement | null)?.blur?.();
            setGenrePickerOpen(true);
          }}
          onChange={setGenreIds}
        />
        <FilterChips
          label={t("list.sortBy")}
          chips={sortOptions}
          activeId={sort}
          onChange={(id) => setSort(id as ListSort)}
        />
      </div>

      <GenrePicker
        open={genrePickerOpen}
        selectedIds={genreIds}
        onClose={() => setGenrePickerOpen(false)}
        onApply={(ids) => {
          setGenreIds(ids);
          setGenrePickerOpen(false);
        }}
      />

      {error && (
        <div className="page__error page__error--row">
          <p>{error}</p>
          <PillButton variant="secondary" onClick={() => void loadList()}>
            {t("list.retry")}
          </PillButton>
        </div>
      )}

      {loading ? (
        <div className="list-load-progress">
          <span className="pill-button__spinner page__spinner" />
          <p className="list-load-progress__label">
            {loadProgress && loadProgress.total
              ? t("list.loadingProgress", {
                  loaded: loadProgress.loaded,
                  total: loadProgress.total,
                })
              : loadProgress && loadProgress.loaded > 0
                ? t("list.loadingCount", { loaded: loadProgress.loaded })
                : t("list.loading")}
          </p>
          {progressPercent !== null && (
            <div className="list-load-progress__bar" aria-hidden="true">
              <div
                className="list-load-progress__fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <AnimeGrid
          anime={sortedAnime}
          subtitle={(a) => {
            const ls = a.my_list_status;
            if (!ls) return "";
            const ep = ls.num_episodes_watched ?? 0;
            const total = a.num_episodes;
            if (total) return t("common.episodesWatched", { watched: ep, total });
            if (ls.score) return t("common.score", { score: ls.score });
            return "";
          }}
          emptyMessage={
            debouncedSearch || genreIds.length > 0
              ? t("list.emptySearch")
              : activeTab === "all"
                ? t("list.emptyAll")
                : t("list.empty", { status: listStatus(activeTab) })
          }
        />
      )}
    </div>
  );
}

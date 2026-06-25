import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { FilterChips } from "@/components/FilterChips";
import { StatsAccordion } from "@/components/StatsAccordion";
import { TabPills } from "@/components/TabPills";
import { useTranslation } from "@/context/SettingsContext";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import "@/styles/components/page.css";
import type { AnimeNode, AnimeStatistics, ListTabFilter } from "@/types/mal";

const LIST_TABS: ListTabFilter[] = [
  "all",
  "watching",
  "completed",
  "plan_to_watch",
  "dropped",
];

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

export function ListPage() {
  const { t, locale } = useTranslation();
  const { listStatus } = useMalLabels();
  const [activeTab, setActiveTab] = useState<ListTabFilter>("all");
  const [sort, setSort] = useState<ListSort>("date_added");
  const [anime, setAnime] = useState<AnimeNode[]>([]);
  const [stats, setStats] = useState<AnimeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshKey } = useAnimeModal();

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

  const sortedAnime = useMemo(
    () => sortAnimeList(anime, sort, locale),
    [anime, sort, locale],
  );

  useEffect(() => {
    api
      .getUserProfile()
      .then((p) => setStats(p.anime_statistics ?? null))
      .catch(() => {});
  }, [refreshKey]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allEntries: AnimeNode[] = [];
      let offset = 0;

      while (true) {
        const listResp = await api.getUserAnimelist(
          activeTab === "all" ? undefined : activeTab,
          100,
          offset,
        );
        allEntries.push(
          ...listResp.data.map((e) => ({
            ...e.node,
            my_list_status: e.list_status ?? e.node.my_list_status,
          })),
        );
        if (!listResp.paging?.next) break;
        offset += 100;
      }

      setAnime(allEntries);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, refreshKey]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const interval = setInterval(loadList, 60_000);
    return () => clearInterval(interval);
  }, [loadList]);

  return (
    <div className="page">
      {stats && (
        <StatsAccordion stats={stats} listCount={filteredListCount} />
      )}

      <TabPills
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as ListTabFilter)}
      />

      <div className="list-toolbar">
        <FilterChips
          label={t("list.sortBy")}
          chips={sortOptions}
          activeId={sort}
          onChange={(id) => setSort(id as ListSort)}
        />
      </div>

      {error && <p className="page__error">{error}</p>}

      {loading ? (
        <div className="page__loading">
          <span className="pill-button__spinner page__spinner" />
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
            activeTab === "all"
              ? t("list.emptyAll")
              : t("list.empty", { status: listStatus(activeTab) })
          }
        />
      )}
    </div>
  );
}

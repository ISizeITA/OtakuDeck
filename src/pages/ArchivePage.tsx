import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { CollapsibleFilter } from "@/components/CollapsibleFilter";
import { GenreFilterBar } from "@/components/GenreFilterBar";
import { GenrePicker } from "@/components/GenrePicker";
import { SearchBar } from "@/components/SearchBar";
import { useRefresh } from "@/context/RefreshContext";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import "@/styles/components/page.css";
import { MEDIA_TYPES, type AnimeNode, type ArchiveSort } from "@/types/mal";

const YEAR_CHIP_IDS = ["", "2026", "2025", "2024", "2020"] as const;

const PAGE_SIZE = 24;

const SORT_OPTIONS: { id: ArchiveSort; sort: string; order: string }[] = [
  { id: "mean", sort: "mean", order: "desc" },
  { id: "title", sort: "title", order: "asc" },
  { id: "start_date", sort: "start_date", order: "desc" },
  { id: "popularity", sort: "popularity", order: "asc" },
];

const MIN_SCORE_IDS = ["", "6", "7", "8"] as const;
const EPISODE_LENGTH_IDS = ["", "short", "medium", "long"] as const;

function episodeRange(length: string): { min?: number; max?: number } {
  switch (length) {
    case "short":
      return { min: 1, max: 12 };
    case "medium":
      return { min: 13, max: 26 };
    case "long":
      return { min: 27 };
    default:
      return {};
  }
}

function mergeAnime(
  prev: AnimeNode[],
  nodes: AnimeNode[],
  reset: boolean,
): AnimeNode[] {
  const base = reset ? [] : prev;
  const seen = new Set(base.map((a) => a.id));
  const merged = [...base];
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      merged.push(node);
    }
  }
  return merged;
}

export function ArchivePage() {
  const { t } = useTranslation();
  const { refreshKey } = useRefresh();
  const { mediaType: mediaTypeLabel } = useMalLabels();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [openFilterMenu, setOpenFilterMenu] = useState<
    "year" | "type" | "sort" | "score" | "episodes" | null
  >(null);
  const [selectedMediaType, setSelectedMediaType] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sortFilter, setSortFilter] = useState<ArchiveSort>("mean");
  const [minScoreFilter, setMinScoreFilter] = useState("");
  const [episodeLengthFilter, setEpisodeLengthFilter] = useState("");
  const [excludeGenreIds, setExcludeGenreIds] = useState<string[]>([]);
  const [excludeGenrePickerOpen, setExcludeGenrePickerOpen] = useState(false);
  const [anime, setAnime] = useState<AnimeNode[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);
  const paginationLoadingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(
    async (pageOffset: number, reset: boolean) => {
      const fetchId = ++fetchIdRef.current;

      if (!reset) {
        if (paginationLoadingRef.current) return;
        paginationLoadingRef.current = true;
      }

      if (reset) {
        paginationLoadingRef.current = false;
        setAnime([]);
        setOffset(0);
        setHasMore(true);
      }

      setLoading(true);
      setError(null);

      try {
        let startDate: string | undefined;
        let endDate: string | undefined;
        if (yearFilter === "2020") {
          startDate = "2020-01-01";
        } else if (yearFilter) {
          startDate = `${yearFilter}-01-01`;
          endDate = `${yearFilter}-12-31`;
        }

        const sortConfig = SORT_OPTIONS.find((o) => o.id === sortFilter) ?? SORT_OPTIONS[0];
        const episodeBounds = episodeRange(episodeLengthFilter);

        const resp = await api.searchAnime({
          query: debouncedQuery.trim().length >= 3 ? debouncedQuery.trim() : undefined,
          limit: PAGE_SIZE,
          offset: pageOffset,
          genres: genreIds.length > 0 ? genreIds.join(",") : undefined,
          exclude_genres:
            excludeGenreIds.length > 0 ? excludeGenreIds.join(",") : undefined,
          media_type: selectedMediaType || undefined,
          start_date: startDate,
          end_date: endDate,
          sort: sortConfig.sort,
          order: sortConfig.order,
          min_score: minScoreFilter ? Number(minScoreFilter) : undefined,
          min_episodes: episodeBounds.min,
          max_episodes: episodeBounds.max,
        });

        if (fetchId !== fetchIdRef.current) return;

        const nodes = resp.data.map((d) => d.node);
        setAnime((prev) => mergeAnime(prev, nodes, reset));

        const pageFull = nodes.length >= PAGE_SIZE;
        setHasMore(!!resp.paging?.next && (pageFull || nodes.length > 0));
        setOffset(nodes.length > 0 ? pageOffset + PAGE_SIZE : 0);
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        setError(String(err));
        setHasMore(false);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
        }
        paginationLoadingRef.current = false;
      }
    },
    [debouncedQuery, genreIds, excludeGenreIds, selectedMediaType, yearFilter, sortFilter, minScoreFilter, episodeLengthFilter],
  );

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage, refreshKey]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasMore &&
          !loading &&
          !paginationLoadingRef.current &&
          offset > 0
        ) {
          void fetchPage(offset, false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [offset, hasMore, loading, fetchPage]);

  const showInitialLoading = loading && anime.length === 0;

  const yearChips = YEAR_CHIP_IDS.map((id) => ({
    id,
    label: id === "" ? t("common.all") : id === "2020" ? "2020+" : id,
  }));

  const mediaTypeChips = MEDIA_TYPES.map((type) => ({
    id: type.value,
    label: mediaTypeLabel(type.value),
  }));

  const sortChips = useMemo(
    () =>
      SORT_OPTIONS.map((option) => ({
        id: option.id,
        label: t(`archive.sort.${option.id}` as "archive.sortBy"),
      })),
    [t],
  );

  const minScoreChips = useMemo(
    () =>
      MIN_SCORE_IDS.map((id) => ({
        id,
        label: id === "" ? t("common.all") : t("archive.minScoreValue", { score: id }),
      })),
    [t],
  );

  const episodeLengthChips = useMemo(
    () =>
      EPISODE_LENGTH_IDS.map((id) => ({
        id,
        label: id === "" ? t("common.all") : t(`archive.episodeLength.${id}` as "archive.episodeLength"),
      })),
    [t],
  );

  const toolbarInert = genrePickerOpen || excludeGenrePickerOpen;

  return (
    <div className="page">
      <div className="archive-toolbar" {...(toolbarInert ? { inert: true } : {})}>
        <SearchBar value={query} onChange={setQuery} />
        <div className="archive-filters-row">
          <div className="archive-filters-row__genres">
            <GenreFilterBar
              selectedIds={genreIds}
              onOpenPicker={() => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                setGenrePickerOpen(true);
              }}
              onChange={setGenreIds}
            />
          </div>
          <div className="archive-filters-row__year">
            <CollapsibleFilter
              label={t("archive.year")}
              chips={yearChips}
              activeId={yearFilter}
              onChange={setYearFilter}
              open={openFilterMenu === "year"}
              onOpenChange={(open) => setOpenFilterMenu(open ? "year" : null)}
              align="center"
            />
          </div>
          <div className="archive-filters-row__type">
            <CollapsibleFilter
              label={t("archive.type")}
              chips={mediaTypeChips}
              activeId={selectedMediaType}
              onChange={setSelectedMediaType}
              open={openFilterMenu === "type"}
              onOpenChange={(open) => setOpenFilterMenu(open ? "type" : null)}
              align="end"
            />
          </div>
        </div>
        <div className="archive-sort-row">
          <CollapsibleFilter
            label={t("archive.sortBy")}
            chips={sortChips}
            activeId={sortFilter}
            onChange={(id) => setSortFilter(id as ArchiveSort)}
            open={openFilterMenu === "sort"}
            onOpenChange={(open) => setOpenFilterMenu(open ? "sort" : null)}
            align="start"
          />
          <CollapsibleFilter
            label={t("archive.minScore")}
            chips={minScoreChips}
            activeId={minScoreFilter}
            onChange={setMinScoreFilter}
            open={openFilterMenu === "score"}
            onOpenChange={(open) => setOpenFilterMenu(open ? "score" : null)}
            align="center"
          />
          <CollapsibleFilter
            label={t("archive.episodeLength")}
            chips={episodeLengthChips}
            activeId={episodeLengthFilter}
            onChange={setEpisodeLengthFilter}
            open={openFilterMenu === "episodes"}
            onOpenChange={(open) => setOpenFilterMenu(open ? "episodes" : null)}
            align="end"
          />
        </div>
        <div className="archive-exclude-row">
          <GenreFilterBar
            labelKey="archive.excludeGenres"
            selectedIds={excludeGenreIds}
            onOpenPicker={() => {
              (document.activeElement as HTMLElement | null)?.blur?.();
              setExcludeGenrePickerOpen(true);
            }}
            onChange={setExcludeGenreIds}
          />
        </div>
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

      <GenrePicker
        open={excludeGenrePickerOpen}
        selectedIds={excludeGenreIds}
        onClose={() => setExcludeGenrePickerOpen(false)}
        onApply={(ids) => {
          setExcludeGenreIds(ids);
          setExcludeGenrePickerOpen(false);
        }}
      />

      {error && <p className="page__error">{error}</p>}

      {showInitialLoading ? (
        <div className="page__loading">
          <span className="pill-button__spinner page__spinner" />
        </div>
      ) : (
        <AnimeGrid anime={anime} />
      )}

      <div ref={sentinelRef} className="archive-sentinel">
        {loading && anime.length > 0 && (
          <span className="pill-button__spinner page__spinner" />
        )}
        {!hasMore && anime.length > 0 && (
          <p className="archive-end">{t("archive.end")}</p>
        )}
      </div>
    </div>
  );
}

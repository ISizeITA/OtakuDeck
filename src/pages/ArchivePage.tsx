import { useCallback, useEffect, useRef, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { FilterChips } from "@/components/FilterChips";
import { MultiFilterChips } from "@/components/MultiFilterChips";
import { SearchBar } from "@/components/SearchBar";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import "@/styles/components/page.css";
import { GENRES, MEDIA_TYPES, type AnimeNode } from "@/types/mal";

const YEAR_CHIP_IDS = ["", "2026", "2025", "2024", "2020"] as const;

const PAGE_SIZE = 24;

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
  const { genre, mediaType: mediaTypeLabel } = useMalLabels();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [selectedMediaType, setSelectedMediaType] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [anime, setAnime] = useState<AnimeNode[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (pageOffset: number, reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
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

        const resp = await api.searchAnime({
          query: debouncedQuery.trim().length >= 3 ? debouncedQuery.trim() : undefined,
          limit: PAGE_SIZE,
          offset: pageOffset,
          genres: genreIds.length > 0 ? genreIds.join(",") : undefined,
          media_type: selectedMediaType || undefined,
          start_date: startDate,
          end_date: endDate,
        });

        const nodes = resp.data.map((d) => d.node);
        setAnime((prev) => mergeAnime(prev, nodes, reset));
        setHasMore(!!resp.paging?.next);
        setOffset(pageOffset + PAGE_SIZE);
      } catch (err) {
        setError(String(err));
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [debouncedQuery, genreIds, selectedMediaType, yearFilter],
  );

  useEffect(() => {
    setAnime([]);
    setOffset(0);
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && offset > 0) {
          fetchPage(offset, false);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [offset, hasMore, loading, fetchPage]);

  const genreChips = GENRES.map((g) => ({
    id: String(g.id),
    label: genre(g.id, g.name),
  }));

  const yearChips = YEAR_CHIP_IDS.map((id) => ({
    id,
    label: id === "" ? t("common.all") : id === "2020" ? "2020+" : id,
  }));

  const mediaTypeChips = MEDIA_TYPES.map((type) => ({
    id: type.value,
    label: mediaTypeLabel(type.value),
  }));

  return (
    <div className="page">
      <div className="archive-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <MultiFilterChips
          label={t("archive.genres")}
          chips={genreChips}
          activeIds={genreIds}
          onChange={setGenreIds}
        />
        <FilterChips
          label={t("archive.year")}
          chips={yearChips}
          activeId={yearFilter}
          onChange={setYearFilter}
        />
        <FilterChips
          label={t("archive.type")}
          chips={mediaTypeChips}
          activeId={selectedMediaType}
          onChange={setSelectedMediaType}
        />
      </div>

      {error && <p className="page__error">{error}</p>}

      <AnimeGrid anime={anime} />

      <div ref={sentinelRef} className="archive-sentinel">
        {loading && <span className="pill-button__spinner page__spinner" />}
        {!hasMore && anime.length > 0 && (
          <p className="archive-end">{t("archive.end")}</p>
        )}
      </div>
    </div>
  );
}

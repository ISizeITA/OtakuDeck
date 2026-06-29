import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useSettings } from "@/context/SettingsContext";
import {
  filterAnimeByQuery,
  mergeSearchResults,
  type SearchResultItem,
  type SearchScope,
} from "@/lib/animeSearch";
import { LIST_CACHE_INVALIDATE_EVENT } from "@/lib/listCache";
import { api } from "@/lib/api";
import {
  GLOBAL_SEARCH_OPEN_EVENT,
  matchesSearchShortcut,
} from "@/lib/keyboardShortcut";
import { getCoverUrl, type AnimeNode } from "@/types/mal";
import "@/styles/components/global-search.css";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 12;

export function GlobalSearch() {
  const { t, searchShortcut, searchShortcutLabel } = useSettings();
  const { openAnime } = useAnimeModal();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<SearchScope>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listCacheRef = useRef<AnimeNode[] | null>(null);
  const listLoadingRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  const selectAnime = useCallback(
    (anime: AnimeNode) => {
      openAnime(anime);
      close();
    },
    [openAnime, close],
  );

  const ensureListCache = useCallback(async () => {
    if (listCacheRef.current !== null || listLoadingRef.current) return;
    listLoadingRef.current = true;
    try {
      const resp = await api.getUserAnimelistAll();
      listCacheRef.current = resp.data.map((entry) => ({
        ...entry.node,
        my_list_status: entry.list_status,
      }));
    } catch {
      listCacheRef.current = [];
    } finally {
      listLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    function onInvalidate() {
      listCacheRef.current = null;
    }
    window.addEventListener(LIST_CACHE_INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(LIST_CACHE_INVALIDATE_EVENT, onInvalidate);
  }, []);

  useEffect(() => {
    void ensureListCache();
  }, [ensureListCache]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matchesSearchShortcut(e, searchShortcut)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, searchShortcut]);

  useEffect(() => {
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, onOpenRequest);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      setActiveIndex(0);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        await ensureListCache();
        const localMatches = filterAnimeByQuery(listCacheRef.current ?? [], trimmed);

        let remoteMatches: AnimeNode[] = [];
        try {
          const resp = await api.searchAnime({ query: trimmed, limit: RESULT_LIMIT });
          remoteMatches = resp.data.map((d) => d.node);
        } catch {
          remoteMatches = [];
        }

        setResults(mergeSearchResults(localMatches, remoteMatches, trimmed, RESULT_LIMIT, scope));
        setActiveIndex(0);
        setLoading(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scope, ensureListCache]);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      selectAnime(results[activeIndex].anime);
    }
  }

  if (!open) return null;

  const trimmed = query.trim();
  const showHint = trimmed.length > 0 && trimmed.length < MIN_QUERY;
  const showEmpty = trimmed.length >= MIN_QUERY && !loading && results.length === 0;

  const scopeOptions: { id: SearchScope; label: string }[] = [
    { id: "all", label: t("search.scopeAll") },
    { id: "list", label: t("search.scopeList") },
    { id: "watching", label: t("search.scopeWatching") },
    { id: "unscored", label: t("search.scopeUnscored") },
  ];

  return (
    <div className="global-search-overlay" onClick={close} role="presentation">
      <div
        className="global-search"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("search.globalTitle")}
      >
        <div className="global-search__input-wrap">
          <svg
            className="global-search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="global-search__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t("search.globalPlaceholder")}
            aria-label={t("search.globalPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="global-search__kbd">Esc</kbd>
        </div>

        <div className="global-search__filters" role="tablist" aria-label={t("search.filters")}>
          {scopeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={scope === option.id}
              className={`global-search__filter${scope === option.id ? " global-search__filter--active" : ""}`}
              onClick={() => setScope(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="global-search__results" role="listbox">
          {loading && (
            <div className="global-search__status">
              <span className="pill-button__spinner global-search__spinner" />
              {t("search.loading")}
            </div>
          )}
          {showHint && (
            <div className="global-search__status">{t("search.minChars")}</div>
          )}
          {showEmpty && (
            <div className="global-search__status">{t("search.noResults")}</div>
          )}
          {!loading &&
            results.map(({ anime, fromList }, index) => (
              <button
                key={anime.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`global-search__item${index === activeIndex ? " global-search__item--active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAnime(anime)}
              >
                <img
                  className="global-search__thumb"
                  src={getCoverUrl(anime)}
                  alt=""
                  loading="lazy"
                />
                <div className="global-search__item-text">
                  <span className="global-search__item-title">{anime.title}</span>
                  <div className="global-search__item-meta-row">
                    {fromList && (
                      <span className="global-search__badge">{t("search.fromList")}</span>
                    )}
                    {anime.mean !== undefined && anime.mean > 0 && (
                      <span className="global-search__item-meta">
                        {anime.mean.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>

        <footer className="global-search__footer">
          <span>{t("search.globalHint")}</span>
          <kbd className="global-search__kbd">{searchShortcutLabel}</kbd>
        </footer>
      </div>
    </div>
  );
}

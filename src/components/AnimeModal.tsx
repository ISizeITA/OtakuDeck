import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PillButton } from "@/components/PillButton";
import { useSettings, useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import {
  malAnimeUrl,
  animeSaturnSearchUrl,
  animeUnitySearchUrl,
  getAnimeSearchTitle,
} from "@/lib/externalLinks";
import { copyAnimeDeepLink } from "@/lib/deepLink";
import { openExternal } from "@/lib/openExternal";
import { invalidateListCache } from "@/lib/listCache";
import "@/styles/components/modal.css";
import { recordRecentAnime } from "@/lib/recentAnime";
import { getCoverUrl, type AnimeNode, type ListStatus } from "@/types/mal";

const STATUS_VALUES: ListStatus[] = [
  "watching",
  "completed",
  "plan_to_watch",
  "dropped",
  "on_hold",
];

interface AnimeModalProps {
  animeId: number;
  preview: AnimeNode | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AnimeModal({ animeId, preview, onClose, onSaved }: AnimeModalProps) {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const { listStatus, mediaType, animeStatus, genre } = useMalLabels();
  const [anime, setAnime] = useState<AnimeNode | null>(preview);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showOriginal, setShowOriginal] = useState(true);
  const [translatedSynopsis, setTranslatedSynopsis] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const [status, setStatus] = useState<ListStatus>("plan_to_watch");
  const [score, setScore] = useState(0);
  const [episodesWatched, setEpisodesWatched] = useState(0);
  const [showStreamingLinks, setShowStreamingLinks] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const statusOptions = useMemo(
    () => STATUS_VALUES.map((value) => ({ value, label: listStatus(value) })),
    [listStatus],
  );

  useEffect(() => {
    let cancelled = false;
    setAnime(preview);
    setLoading(true);
    setError(null);
    setStatus("plan_to_watch");
    setScore(0);
    setEpisodesWatched(0);

    api
      .getAnimeDetails(animeId)
      .then((data) => {
        if (cancelled) return;
        setAnime(data);
        recordRecentAnime(data);
        const ls = data.my_list_status;
        if (ls?.status) setStatus(ls.status as ListStatus);
        if (ls?.score !== undefined) setScore(ls.score);
        if (ls?.num_episodes_watched !== undefined)
          setEpisodesWatched(ls.num_episodes_watched);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [animeId, preview]);

  useEffect(() => {
    api
      .getAppPreferences()
      .then((prefs) => setShowStreamingLinks(prefs.show_streaming_search_links))
      .catch(() => setShowStreamingLinks(false));
  }, []);

  useEffect(() => {
    setShowOriginal(true);
    setTranslatedSynopsis(null);
    setTranslating(false);
    setTranslateError(null);
  }, [animeId, locale]);

  const canTranslate = locale !== "en";

  const handleTranslate = useCallback(async () => {
    const synopsis = anime?.synopsis;
    if (!synopsis) return;

    if (!showOriginal) {
      setShowOriginal(true);
      return;
    }

    if (translatedSynopsis) {
      setShowOriginal(false);
      return;
    }

    setTranslating(true);
    setTranslateError(null);
    try {
      const result = await api.translateSynopsis(animeId, synopsis, locale);
      setTranslatedSynopsis(result);
      setShowOriginal(false);
    } catch (err) {
      const msg = String(err);
      setTranslateError(
        msg.includes("QUOTA_INSUFFICIENT")
          ? t("modal.translateQuotaError")
          : t("modal.translateError"),
      );
    } finally {
      setTranslating(false);
    }
  }, [anime?.synopsis, animeId, locale, showOriginal, t, translatedSynopsis]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const episodesPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistListChanges = useCallback(
    async (
      nextStatus: ListStatus,
      nextScore: number,
      nextEpisodes: number,
      closeAfter = false,
    ) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await api.updateListStatus(
          animeId,
          nextStatus,
          nextScore > 0 ? nextScore : undefined,
          nextEpisodes,
          anime?.num_episodes,
        );
        setAnime((prev) =>
          prev
            ? {
                ...prev,
                my_list_status: {
                  ...prev.my_list_status,
                  status: updated.status ?? nextStatus,
                  score: updated.score ?? (nextScore > 0 ? nextScore : undefined),
                  num_episodes_watched:
                    updated.num_episodes_watched ?? nextEpisodes,
                },
              }
            : prev,
        );
        invalidateListCache();
        onSaved();
        if (closeAfter) onClose();
      } catch (err) {
        setError(String(err));
      } finally {
        setSaving(false);
      }
    },
    [anime?.num_episodes, animeId, onClose, onSaved],
  );

  const handleEpisodesChange = useCallback(
    (value: number) => {
      const total = anime?.num_episodes ?? 0;
      const nextStatus: ListStatus =
        total > 0 && value >= total ? "completed" : status;
      setEpisodesWatched(value);
      if (nextStatus !== status) setStatus(nextStatus);
      return nextStatus;
    },
    [anime?.num_episodes, status],
  );

  const persistEpisodes = useCallback(
    (value: number, nextStatus: ListStatus = status) => {
      if (loading || saving) return;
      if (episodesPersistTimer.current) {
        clearTimeout(episodesPersistTimer.current);
      }
      episodesPersistTimer.current = setTimeout(() => {
        void persistListChanges(nextStatus, score, value);
      }, 450);
    },
    [loading, persistListChanges, saving, score, status],
  );

  useEffect(
    () => () => {
      if (episodesPersistTimer.current) clearTimeout(episodesPersistTimer.current);
    },
    [],
  );

  const handleEpisodeAdjust = useCallback(
    (value: number) => {
      const nextStatus = handleEpisodesChange(value);
      if (!loading && !saving) {
        void persistListChanges(nextStatus, score, value);
      }
    },
    [handleEpisodesChange, loading, persistListChanges, saving, score],
  );

  const handleScoreSelect = useCallback(
    (n: number) => {
      if (loading || saving) return;
      const next = n === score ? 0 : n;
      if (next === score) return;
      setScore(next);
      void persistListChanges(status, next, episodesWatched);
    },
    [episodesWatched, loading, persistListChanges, saving, score, status],
  );

  const handleStatusSelect = useCallback(
    (next: ListStatus) => {
      if (loading || saving || next === status) return;
      let nextEpisodes = episodesWatched;
      if (next === "completed" && anime?.num_episodes && anime.num_episodes > 0) {
        nextEpisodes = anime.num_episodes;
        setEpisodesWatched(nextEpisodes);
      }
      setStatus(next);
      void persistListChanges(next, score, nextEpisodes);
    },
    [anime?.num_episodes, episodesWatched, loading, persistListChanges, saving, score, status],
  );

  const handleSave = async () => {
    await persistListChanges(status, score, episodesWatched, true);
  };

  const display = anime;
  const sourceLabel = (source: string) => {
    const key = `source.${source}` as const;
    const translated = t(key as "modal.source");
    return translated === key ? source.replace(/_/g, " ") : translated;
  };
  const synopsisText =
    !showOriginal && translatedSynopsis ? translatedSynopsis : display?.synopsis;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {loading && !display ? (
          <div className="modal__loading">
            <span className="pill-button__spinner" />
          </div>
        ) : display ? (
          <>
            <div className="modal__cover-side">
              <img
                className="modal__cover"
                src={getCoverUrl(display)}
                alt={display.title}
              />
            </div>
            <div className="modal__content">
              <button
                type="button"
                className="modal__close"
                onClick={onClose}
                aria-label={t("common.close")}
              >
                ×
              </button>

              <h2 id="modal-title" className="modal__title">
                {display.title}
              </h2>

              <div className="modal__meta">
                {display.media_type && (
                  <span className="modal__badge">
                    {mediaType(display.media_type)}
                  </span>
                )}
                {display.status && (
                  <span className="modal__badge">
                    {animeStatus(display.status)}
                  </span>
                )}
                {display.num_episodes !== undefined && display.num_episodes > 0 && (
                  <span className="modal__badge">
                    {t("common.episodes", { count: display.num_episodes })}
                  </span>
                )}
              </div>

              {display.genres && display.genres.length > 0 && (
                <div className="modal__genres">
                  {display.genres.map((g) => (
                    <span key={g.id} className="modal__genre-pill">
                      {genre(g.id, g.name)}
                    </span>
                  ))}
                </div>
              )}

              <div className="modal__links">
                <button
                  type="button"
                  className="modal__link-btn modal__link-btn--secondary"
                  onClick={() => {
                    void copyAnimeDeepLink(display.id).then(() => {
                      setLinkCopied(true);
                      window.setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }}
                >
                  {linkCopied ? t("modal.linkCopied") : t("modal.copyLink")}
                </button>
                <button
                  type="button"
                  className="modal__link-btn"
                  onClick={() => void openExternal(malAnimeUrl(display.id))}
                >
                  {t("modal.openMal")}
                </button>
                {showStreamingLinks && (
                  <>
                    <button
                      type="button"
                      className="modal__link-btn modal__link-btn--secondary"
                      title={t("modal.streamingSearchDisclaimer")}
                      onClick={() =>
                        void openExternal(
                          animeSaturnSearchUrl(getAnimeSearchTitle(display)),
                        )
                      }
                    >
                      {t("modal.searchSaturn")}
                    </button>
                    <button
                      type="button"
                      className="modal__link-btn modal__link-btn--secondary"
                      title={t("modal.streamingSearchDisclaimer")}
                      onClick={() =>
                        void openExternal(
                          animeUnitySearchUrl(getAnimeSearchTitle(display)),
                        )
                      }
                    >
                      {t("modal.searchUnity")}
                    </button>
                  </>
                )}
              </div>
              {showStreamingLinks && (
                <p className="modal__links-disclaimer">
                  {t("modal.streamingSearchDisclaimer")}
                </p>
              )}

              <div className="modal__scores">
                {display.mean !== undefined && display.mean > 0 && (
                  <div className="modal__score-block">
                    <span className="modal__score-value">{display.mean.toFixed(2)}</span>
                    <span className="modal__score-label">{t("modal.malScore")}</span>
                  </div>
                )}
                {display.rank !== undefined && display.rank > 0 && (
                  <div className="modal__score-block">
                    <span className="modal__score-value">#{display.rank}</span>
                    <span className="modal__score-label">{t("modal.rank")}</span>
                  </div>
                )}
                {display.popularity !== undefined && display.popularity > 0 && (
                  <div className="modal__score-block">
                    <span className="modal__score-value">#{display.popularity}</span>
                    <span className="modal__score-label">{t("modal.popularity")}</span>
                  </div>
                )}
              </div>

              <div className="modal__dates">
                {display.start_date && (
                  <span>
                    {t("common.start")}: {display.start_date.split("T")[0]}
                  </span>
                )}
                {display.end_date && (
                  <span>
                    {t("common.end")}: {display.end_date.split("T")[0]}
                  </span>
                )}
              </div>

              {(display.studios?.length || display.source) && (
                <div className="modal__production">
                  {display.studios && display.studios.length > 0 && (
                    <p>
                      <span className="modal__production-label">
                        {t("modal.studios")}
                      </span>
                      {display.studios.map((s) => s.name).join(", ")}
                    </p>
                  )}
                  {display.source && (
                    <p>
                      <span className="modal__production-label">
                        {t("modal.source")}
                      </span>
                      {sourceLabel(display.source)}
                    </p>
                  )}
                </div>
              )}

              {display.synopsis && (
                <div className="modal__synopsis-block">
                  {canTranslate && (
                    <div className="modal__synopsis-toolbar">
                      <PillButton
                        variant="secondary"
                        onClick={handleTranslate}
                        loading={translating}
                        disabled={translating}
                      >
                        {translating
                          ? t("modal.translating")
                          : showOriginal
                            ? t("modal.translate")
                            : t("modal.showOriginal")}
                      </PillButton>
                    </div>
                  )}
                  <div className="modal__synopsis">
                    <p>{synopsisText}</p>
                  </div>
                  {translateError && (
                    <p className="modal__translate-error">{translateError}</p>
                  )}
                </div>
              )}

              <div className="modal__actions">
                <h3 className="modal__actions-title">{t("modal.yourList")}</h3>

                <div className="modal__status-pills">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`modal__status-pill ${status === opt.value ? "modal__status-pill--active" : ""}`}
                      onClick={() => handleStatusSelect(opt.value)}
                      disabled={saving}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="modal__field">
                  <label className="modal__field-label" htmlFor="episodes">
                    {t("modal.episodesWatched")}
                  </label>
                  <div className="modal__episode-control">
                    <button
                      type="button"
                      className="modal__episode-btn"
                      onClick={() =>
                        handleEpisodeAdjust(Math.max(0, episodesWatched - 1))
                      }
                      disabled={saving}
                    >
                      −
                    </button>
                    <input
                      id="episodes"
                      className="modal__episode-input"
                      type="number"
                      min={0}
                      max={display.num_episodes || 9999}
                      value={episodesWatched}
                      onChange={(e) => {
                        const value = Math.max(0, parseInt(e.target.value) || 0);
                        const nextStatus = handleEpisodesChange(value);
                        persistEpisodes(value, nextStatus);
                      }}
                      onBlur={() => {
                        if (loading || saving) return;
                        const total = display.num_episodes ?? 0;
                        const nextStatus: ListStatus =
                          total > 0 && episodesWatched >= total
                            ? "completed"
                            : status;
                        void persistListChanges(nextStatus, score, episodesWatched);
                      }}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="modal__episode-btn"
                      onClick={() => handleEpisodeAdjust(episodesWatched + 1)}
                      disabled={saving}
                    >
                      +
                    </button>
                    {display.num_episodes !== undefined && display.num_episodes > 0 && (
                      <span className="modal__episode-total">/ {display.num_episodes}</span>
                    )}
                  </div>
                </div>

                <div className="modal__field">
                  <label className="modal__field-label">{t("modal.personalScore")}</label>
                  <div className="modal__score-pills">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`modal__score-pill ${score === n ? "modal__score-pill--active" : ""}`}
                        onClick={() => handleScoreSelect(n)}
                        disabled={saving}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="modal__error">{error}</p>}

                <PillButton
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={saving}
                >
                  {t("modal.save")}
                </PillButton>
              </div>
            </div>
          </>
        ) : (
          <div className="modal__error-state">{error ?? t("modal.notFound")}</div>
        )}
      </div>
    </div>
  );
}

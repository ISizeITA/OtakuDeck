import { useEffect, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { useRefresh } from "@/context/RefreshContext";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { translate, type TranslationKey } from "@/i18n/translations";
import { api } from "@/lib/api";
import { cacheExpiryFromResponse, mergeCacheExpiry } from "@/lib/cacheExpiry";
import "@/styles/components/page.css";
import { getCurrentSeason, type AnimeListEntry, type AnimeNode } from "@/types/mal";

const LOAD_GAP_MS = 400;

function entryToNode(entry: AnimeListEntry): AnimeNode {
  return {
    ...entry.node,
    my_list_status: entry.list_status,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function HomePage() {
  const { t, locale } = useTranslation();
  const { mediaType, season } = useMalLabels();
  const { refreshKey } = useRefresh();
  const [suggestions, setSuggestions] = useState<AnimeNode[]>([]);
  const [continueWatching, setContinueWatching] = useState<AnimeNode[]>([]);
  const [seasonal, setSeasonal] = useState<AnimeNode[]>([]);
  const [airing, setAiring] = useState<AnimeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cacheExpiresAt, setCacheExpiresAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const { year, season: seasonKey } = getCurrentSeason();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    async function load() {
      const errs: string[] = [];
      let usedCache = false;
      let expiresAt: string | null = null;
      const forceRefresh = refreshKey > 0;

      try {
        const sea = await api.getSeasonalAnime(year, seasonKey, 12, 0, forceRefresh);
        if (cancelled) return;
        setSeasonal(sea.data.data.map((d) => d.node));
        usedCache = usedCache || sea.from_cache;
        expiresAt = mergeCacheExpiry(
          expiresAt,
          cacheExpiryFromResponse(sea.from_cache, sea.cache_expires_at),
        );
      } catch (err) {
        errs.push(
          `${translate(locale, "home.errorSeasonal" as TranslationKey)}: ${err}`,
        );
      }

      await sleep(LOAD_GAP_MS);
      if (cancelled) return;

      try {
        const air = await api.getAiringAnime(12, 0, forceRefresh);
        if (cancelled) return;
        setAiring(air.data.data.map((d) => d.node));
        usedCache = usedCache || air.from_cache;
        expiresAt = mergeCacheExpiry(
          expiresAt,
          cacheExpiryFromResponse(air.from_cache, air.cache_expires_at),
        );
      } catch (err) {
        errs.push(`${translate(locale, "home.errorAiring" as TranslationKey)}: ${err}`);
      }

      await sleep(LOAD_GAP_MS);
      if (cancelled) return;

      try {
        const cont = await api.getContinueWatching(forceRefresh);
        if (cancelled) return;
        setContinueWatching(cont.data.map(entryToNode));
        usedCache = usedCache || cont.from_cache;
        expiresAt = mergeCacheExpiry(
          expiresAt,
          cacheExpiryFromResponse(cont.from_cache, cont.cache_expires_at),
        );
      } catch (err) {
        errs.push(
          `${translate(locale, "home.errorContinue" as TranslationKey)}: ${err}`,
        );
      }

      await sleep(LOAD_GAP_MS);
      if (cancelled) return;

      try {
        const sug = await api.getSuggestions(forceRefresh);
        if (cancelled) return;
        setSuggestions(sug.data);
        usedCache = usedCache || sug.from_cache;
        expiresAt = mergeCacheExpiry(
          expiresAt,
          cacheExpiryFromResponse(sug.from_cache, sug.cache_expires_at),
        );
      } catch (err) {
        errs.push(
          `${translate(locale, "home.errorSuggestions" as TranslationKey)}: ${err}`,
        );
      }

      if (cancelled) return;
      setOffline(usedCache);
      setCacheExpiresAt(expiresAt);
      setErrors(errs);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [year, seasonKey, locale, refreshKey]);

  if (loading) {
    return (
      <div className="page page--centered">
        <span className="pill-button__spinner page__spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <OfflineBanner visible={offline} expiresAt={cacheExpiresAt} />

      {errors.length > 0 && (
        <div className="page__error">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {continueWatching.length > 0 && (
        <section className="page__section">
          <SectionHeader
            title={t("home.continueTitle")}
            subtitle={t("home.continueSubtitle")}
          />
          <AnimeGrid
            anime={continueWatching}
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
            season: season(seasonKey),
            year,
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

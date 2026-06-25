import { useEffect, useState } from "react";
import { AnimeGrid } from "@/components/AnimeGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { useTranslation } from "@/context/SettingsContext";
import { useMalLabels } from "@/hooks/useMalLabels";
import { api } from "@/lib/api";
import "@/styles/components/page.css";
import { getCurrentSeason, type AnimeNode } from "@/types/mal";

export function HomePage() {
  const { t } = useTranslation();
  const { mediaType, season } = useMalLabels();
  const [suggestions, setSuggestions] = useState<AnimeNode[]>([]);
  const [seasonal, setSeasonal] = useState<AnimeNode[]>([]);
  const [airing, setAiring] = useState<AnimeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const { year, season: seasonKey } = getCurrentSeason();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    async function load() {
      const errs: string[] = [];

      const [sug, sea, air] = await Promise.allSettled([
        api.getSuggestions(),
        api.getSeasonalAnime(year, seasonKey, 12),
        api.getAiringAnime(24),
      ]);

      if (cancelled) return;

      if (sug.status === "fulfilled") setSuggestions(sug.value);
      else errs.push(`${t("home.errorSuggestions")}: ${sug.reason}`);

      if (sea.status === "fulfilled") setSeasonal(sea.value.data.map((d) => d.node));
      else errs.push(`${t("home.errorSeasonal")}: ${sea.reason}`);

      if (air.status === "fulfilled") setAiring(air.value.data.map((d) => d.node));
      else errs.push(`${t("home.errorAiring")}: ${air.reason}`);

      setErrors(errs);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [year, seasonKey, t]);

  if (loading) {
    return (
      <div className="page page--centered">
        <span className="pill-button__spinner page__spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      {errors.length > 0 && (
        <div className="page__error">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
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

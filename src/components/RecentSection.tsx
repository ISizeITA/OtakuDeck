import { useMemo } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { useAnimeModal } from "@/context/AnimeModalContext";
import { useTranslation } from "@/context/SettingsContext";
import { loadRecentAnime } from "@/lib/recentAnime";
import "@/styles/components/recent.css";
import { getCoverUrl, type AnimeNode } from "@/types/mal";

export function RecentSection() {
  const { t } = useTranslation();
  const { openAnime, refreshKey } = useAnimeModal();
  const recent = useMemo(() => loadRecentAnime(), [refreshKey]);

  if (recent.length === 0) return null;

  return (
    <section className="page__section">
      <SectionHeader title={t("home.recentTitle")} subtitle={t("home.recentSubtitle")} />
      <ul className="recent-list">
        {recent.map((anime: AnimeNode) => (
          <li key={anime.id}>
            <button type="button" className="recent-item" onClick={() => openAnime(anime)}>
              <img
                className="recent-item__cover"
                src={getCoverUrl(anime)}
                alt=""
                loading="lazy"
              />
              <span className="recent-item__title">{anime.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

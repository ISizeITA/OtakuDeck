import { AnimeCard } from "@/components/AnimeCard";
import { useTranslation } from "@/context/SettingsContext";
import { useAnimeModal } from "@/context/AnimeModalContext";
import "@/styles/components/anime-grid.css";
import type { AnimeNode } from "@/types/mal";

interface AnimeGridProps {
  anime: AnimeNode[];
  subtitle?: (anime: AnimeNode) => string;
  emptyMessage?: string;
  newEpisodeIds?: Set<number>;
}

export function AnimeGrid({ anime, subtitle, emptyMessage, newEpisodeIds }: AnimeGridProps) {
  const { t } = useTranslation();
  const { openAnime } = useAnimeModal();
  const resolvedEmpty = emptyMessage ?? t("common.noAnimeFound");

  if (anime.length === 0) {
    return <p className="anime-grid__empty">{resolvedEmpty}</p>;
  }

  return (
    <div className="anime-grid">
      {anime.map((item) => (
        <AnimeCard
          key={item.id}
          anime={item}
          subtitle={subtitle?.(item)}
          isNewEpisode={newEpisodeIds?.has(item.id)}
          onClick={() => openAnime(item)}
        />
      ))}
    </div>
  );
}

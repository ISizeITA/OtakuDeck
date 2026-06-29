import "@/styles/components/anime-card.css";
import { CachedCover } from "@/components/CachedCover";
import { NewEpisodeBadge } from "@/components/NewEpisodeBadge";
import type { AnimeNode } from "@/types/mal";

interface AnimeCardProps {
  anime: AnimeNode;
  onClick?: () => void;
  subtitle?: string;
  isNewEpisode?: boolean;
}

export function AnimeCard({ anime, onClick, subtitle, isNewEpisode = false }: AnimeCardProps) {
  return (
    <button type="button" className="anime-card" onClick={onClick}>
      <div className="anime-card__cover-wrap">
        <CachedCover anime={anime} className="anime-card__cover" alt={anime.title} />
        <div className="anime-card__overlay" />
        {isNewEpisode && <NewEpisodeBadge />}
        {anime.mean !== undefined && anime.mean > 0 && (
          <span className="anime-card__score">{anime.mean.toFixed(1)}</span>
        )}
      </div>
      <div className="anime-card__info">
        <h3 className="anime-card__title">{anime.title}</h3>
        {subtitle && <p className="anime-card__subtitle">{subtitle}</p>}
      </div>
    </button>
  );
}

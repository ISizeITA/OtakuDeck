import "@/styles/components/anime-card.css";
import { getCoverUrl, type AnimeNode } from "@/types/mal";

interface AnimeCardProps {
  anime: AnimeNode;
  onClick?: () => void;
  subtitle?: string;
}

export function AnimeCard({ anime, onClick, subtitle }: AnimeCardProps) {
  return (
    <button type="button" className="anime-card" onClick={onClick}>
      <div className="anime-card__cover-wrap">
        <img
          className="anime-card__cover"
          src={getCoverUrl(anime)}
          alt={anime.title}
          loading="lazy"
        />
        <div className="anime-card__overlay" />
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

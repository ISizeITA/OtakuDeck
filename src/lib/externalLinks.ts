import type { AnimeNode } from "@/types/mal";

export function malAnimeUrl(animeId: number): string {
  return `https://myanimelist.net/anime/${animeId}`;
}

/** Prefer English alternative title for third-party site searches. */
export function getAnimeSearchTitle(anime: Pick<AnimeNode, "title" | "alternative_titles">): string {
  const en = anime.alternative_titles?.en?.trim();
  return en || anime.title;
}

/** Best-effort search URL — result may not match the anime. */
export function animeSaturnSearchUrl(title: string): string {
  return `https://www.animesaturn.cx/filter?keyword=${encodeURIComponent(title)}`;
}

/** Best-effort search URL — result may not match the anime. */
export function animeUnitySearchUrl(title: string): string {
  return `https://www.animeunity.so/cerca?q=${encodeURIComponent(title)}`;
}

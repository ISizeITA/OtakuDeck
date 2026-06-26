import type { AnimeNode } from "@/types/mal";

const RECENT_KEY = "otakudeck-recent-anime";
const MAX_RECENT = 10;

export function recordRecentAnime(anime: AnimeNode) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: AnimeNode[] = raw ? (JSON.parse(raw) as AnimeNode[]) : [];
    const filtered = list.filter((item) => item.id !== anime.id);
    const next = [{ id: anime.id, title: anime.title, main_picture: anime.main_picture, num_episodes: anime.num_episodes }, ...filtered];
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
  } catch {
    // ignore storage errors
  }
}

export function loadRecentAnime(): AnimeNode[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as AnimeNode[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

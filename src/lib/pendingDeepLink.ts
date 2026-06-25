const PENDING_ANIME_KEY = "otakudeck-pending-anime-id";
export const PENDING_ANIME_EVENT = "otakudeck-pending-anime";

export function enqueuePendingAnimeId(id: number) {
  localStorage.setItem(PENDING_ANIME_KEY, String(id));
  window.dispatchEvent(new CustomEvent(PENDING_ANIME_EVENT, { detail: id }));
}

export function takePendingAnimeId(): number | null {
  const raw = localStorage.getItem(PENDING_ANIME_KEY);
  if (!raw) return null;
  localStorage.removeItem(PENDING_ANIME_KEY);
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function peekPendingAnimeId(): number | null {
  const raw = localStorage.getItem(PENDING_ANIME_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

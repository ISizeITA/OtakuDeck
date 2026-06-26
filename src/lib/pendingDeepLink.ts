import type { NavDeepLinkTab } from "@/lib/deepLink";
import type { NavTab } from "@/types/mal";

const PENDING_ANIME_KEY = "otakudeck-pending-anime-id";
const PENDING_NAV_KEY = "otakudeck-pending-nav";
export const PENDING_ANIME_EVENT = "otakudeck-pending-anime";
export const PENDING_NAV_EVENT = "otakudeck-pending-nav";

export function navTabFromDeepLink(tab: NavDeepLinkTab): NavTab {
  if (tab === "list") return "list";
  if (tab === "calendar") return "calendar";
  return "home";
}

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

export function enqueuePendingNav(tab: NavDeepLinkTab) {
  localStorage.setItem(PENDING_NAV_KEY, tab);
  window.dispatchEvent(new CustomEvent(PENDING_NAV_EVENT, { detail: tab }));
}

export function takePendingNav(): NavDeepLinkTab | null {
  const raw = localStorage.getItem(PENDING_NAV_KEY);
  if (!raw) return null;
  localStorage.removeItem(PENDING_NAV_KEY);
  if (raw === "list" || raw === "calendar" || raw === "home") return raw;
  return null;
}

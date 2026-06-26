/** Returns true if the URL is an OAuth callback (handled by useAuth). */
export function isOAuthCallbackUrl(url: string): boolean {
  try {
    const normalized = url.includes("://") ? url : `otakudeck://${url}`;
    const parsed = new URL(normalized);
    return parsed.searchParams.has("code") && parsed.searchParams.has("state");
  } catch {
    const query = url.includes("?") ? url.split("?")[1] : "";
    const params = new URLSearchParams(query);
    return params.has("code") && params.has("state");
  }
}

/**
 * Parse `otakudeck://anime/{id}` (and variants) into a MAL anime id.
 * Supports: otakudeck://anime/123, otakudeck://open/anime/123, otakudeck:///anime/123
 */
export function parseAnimeDeepLink(url: string): number | null {
  if (isOAuthCallbackUrl(url)) return null;
  if (parseNavDeepLink(url) !== null) return null;

  try {
    const normalized = url.includes("://") ? url : `otakudeck://${url}`;
    const parsed = new URL(normalized);

    if (parsed.protocol !== "otakudeck:") return null;

    // otakudeck://anime/123 → host "anime", pathname "/123"
    if (parsed.hostname === "anime") {
      const id = parseInt(parsed.pathname.replace(/^\//, ""), 10);
      return Number.isFinite(id) && id > 0 ? id : null;
    }

    const pathMatch = parsed.pathname.match(/\/anime\/(\d+)/);
    if (pathMatch) {
      const id = parseInt(pathMatch[1], 10);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  } catch {
    const match = url.match(/anime\/(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  }

  return null;
}

export type NavDeepLinkTab = "home" | "list" | "calendar";

/** Parse `otakudeck://list`, `otakudeck://calendar`, `otakudeck://home`. */
export function parseNavDeepLink(url: string): NavDeepLinkTab | null {
  if (isOAuthCallbackUrl(url)) return null;

  try {
    const normalized = url.includes("://") ? url : `otakudeck://${url}`;
    const parsed = new URL(normalized);
    if (parsed.protocol !== "otakudeck:") return null;

    const host = parsed.hostname.toLowerCase();
    if (host === "list" || host === "calendar" || host === "home") {
      return host;
    }

    const path = parsed.pathname.replace(/^\//, "").toLowerCase();
    if (path === "list" || path === "calendar" || path === "home") {
      return path as NavDeepLinkTab;
    }
  } catch {
    const match = url.match(/(?:otakudeck:\/\/)?(list|calendar|home)/i);
    if (match) {
      return match[1].toLowerCase() as NavDeepLinkTab;
    }
  }

  return null;
}

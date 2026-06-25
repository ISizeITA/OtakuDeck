import type { AnimeNode } from "@/types/mal";

export interface SearchResultItem {
  anime: AnimeNode;
  fromList: boolean;
}

export function filterAnimeByQuery(anime: AnimeNode[], query: string): AnimeNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return anime.filter((entry) => {
    const title = entry.title.toLowerCase();
    const altEn = entry.alternative_titles?.en?.toLowerCase() ?? "";
    const altJa = entry.alternative_titles?.ja?.toLowerCase() ?? "";
    return (
      title.includes(trimmed) ||
      altEn.includes(trimmed) ||
      altJa.includes(trimmed)
    );
  });
}

export function mergeSearchResults(
  local: AnimeNode[],
  remote: AnimeNode[],
  limit = 12,
): SearchResultItem[] {
  const seen = new Set<number>();
  const merged: SearchResultItem[] = [];

  for (const anime of local) {
    if (merged.length >= limit) break;
    if (seen.has(anime.id)) continue;
    seen.add(anime.id);
    merged.push({ anime, fromList: true });
  }

  for (const anime of remote) {
    if (merged.length >= limit) break;
    if (seen.has(anime.id)) continue;
    seen.add(anime.id);
    merged.push({ anime, fromList: false });
  }

  return merged;
}

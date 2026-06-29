import type { AnimeNode } from "@/types/mal";

export type SearchScope = "all" | "list" | "watching" | "unscored";

export interface SearchResultItem {
  anime: AnimeNode;
  fromList: boolean;
  score: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function scoreAnime(entry: AnimeNode, query: string): number {
  const q = normalize(query.trim());
  if (!q) return 0;

  const title = normalize(entry.title);
  const altEn = normalize(entry.alternative_titles?.en ?? "");
  const altJa = normalize(entry.alternative_titles?.ja ?? "");

  if (title === q) return 100;
  if (title.startsWith(q)) return 85;
  if (title.includes(q)) return 70;
  if (altEn.includes(q)) return 55;
  if (altJa.includes(q)) return 50;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let tokenScore = 0;
  for (const token of tokens) {
    if (title.includes(token)) tokenScore += 28;
    else if (altEn.includes(token)) tokenScore += 18;
    else if (altJa.includes(token)) tokenScore += 14;
  }

  return tokenScore;
}

export function filterAnimeByQuery(anime: AnimeNode[], query: string): AnimeNode[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return anime
    .map((entry) => ({ entry, score: scoreAnime(entry, trimmed) }))
    .filter(({ score }) => score >= 20)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}

export function matchesSearchScope(
  anime: AnimeNode,
  fromList: boolean,
  scope: SearchScope,
): boolean {
  switch (scope) {
    case "all":
      return true;
    case "list":
      return fromList;
    case "watching":
      return anime.my_list_status?.status === "watching";
    case "unscored":
      return (
        fromList &&
        (anime.my_list_status?.score === undefined ||
          anime.my_list_status.score === 0)
      );
    default:
      return true;
  }
}

export function mergeSearchResults(
  local: AnimeNode[],
  remote: AnimeNode[],
  query: string,
  limit = 12,
  scope: SearchScope = "all",
): SearchResultItem[] {
  const trimmed = query.trim();
  const seen = new Set<number>();
  const merged: SearchResultItem[] = [];

  const rankedLocal = local
    .map((anime) => ({ anime, score: scoreAnime(anime, trimmed), fromList: true }))
    .filter((item) => item.score >= 20)
    .sort((a, b) => b.score - a.score);

  for (const item of rankedLocal) {
    if (merged.length >= limit) break;
    if (seen.has(item.anime.id)) continue;
    if (!matchesSearchScope(item.anime, true, scope)) continue;
    seen.add(item.anime.id);
    merged.push(item);
  }

  for (const anime of remote) {
    if (merged.length >= limit) break;
    if (seen.has(anime.id)) continue;
    const score = scoreAnime(anime, trimmed);
    if (score < 20) continue;
    const fromList = false;
    if (!matchesSearchScope(anime, fromList, scope)) continue;
    seen.add(anime.id);
    merged.push({ anime, fromList, score });
  }

  return merged.sort((a, b) => b.score - a.score);
}

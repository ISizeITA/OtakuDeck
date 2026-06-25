export interface Picture {
  medium?: string;
  large?: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MyListStatus {
  status?: string;
  score?: number;
  num_episodes_watched?: number;
  is_rewatching?: boolean;
  start_date?: string;
  finish_date?: string;
}

export interface AnimeNode {
  id: number;
  title: string;
  main_picture?: Picture;
  alternative_titles?: { en?: string; ja?: string };
  mean?: number;
  rank?: number;
  popularity?: number;
  num_episodes?: number;
  media_type?: string;
  status?: string;
  synopsis?: string;
  start_date?: string;
  end_date?: string;
  genres?: Genre[];
  my_list_status?: MyListStatus;
  num_list_users?: number;
}

export interface AnimeListEntry {
  node: AnimeNode;
  list_status?: MyListStatus;
}

export interface Paging {
  previous?: string;
  next?: string;
}

export interface AnimeSearchResponse {
  data: { node: AnimeNode }[];
  paging?: Paging;
}

export interface AnimeListResponse {
  data: AnimeListEntry[];
  paging?: Paging;
}

export interface AnimeStatistics {
  num_items_watching?: number;
  num_items_completed?: number;
  num_items_on_hold?: number;
  num_items_dropped?: number;
  num_items_plan_to_watch?: number;
  num_items?: number;
  num_days?: number;
  num_episodes?: number;
  mean_score?: number;
}

export interface UserProfile {
  id: number;
  name: string;
  picture?: string;
  anime_statistics?: AnimeStatistics;
}

export interface SearchAnimeParams {
  query?: string;
  limit?: number;
  offset?: number;
  genres?: string;
  media_type?: string;
  status?: string;
  sort?: string;
  order?: string;
  min_score?: number;
  start_date?: string;
  end_date?: string;
}

export type ListStatus =
  | "watching"
  | "completed"
  | "plan_to_watch"
  | "dropped"
  | "on_hold";

export type ListTabFilter = "all" | ListStatus;

export type NavTab = "home" | "archive" | "list";

export const LIST_STATUS_LABELS: Record<ListStatus, string> = {
  watching: "In Visione",
  completed: "Completati",
  plan_to_watch: "Da Vedere",
  dropped: "Lasciati",
  on_hold: "In Pausa",
};

export const MEDIA_TYPES = [
  { value: "", label: "Tutti" },
  { value: "tv", label: "TV" },
  { value: "ova", label: "OVA" },
  { value: "ona", label: "ONA" },
  { value: "movie", label: "Film" },
  { value: "special", label: "Special" },
] as const;

export const GENRES = [
  { id: 1, name: "Action" },
  { id: 2, name: "Adventure" },
  { id: 4, name: "Comedy" },
  { id: 8, name: "Drama" },
  { id: 10, name: "Fantasy" },
  { id: 14, name: "Horror" },
  { id: 22, name: "Romance" },
  { id: 24, name: "Sci-Fi" },
  { id: 36, name: "Slice of Life" },
  { id: 37, name: "Sports" },
  { id: 41, name: "Suspense" },
  { id: 18, name: "Mecha" },
  { id: 40, name: "Psychological" },
  { id: 23, name: "School" },
  { id: 27, name: "Shounen" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  finished_airing: "Terminato",
  currently_airing: "In corso",
  not_yet_aired: "Non ancora uscito",
};

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  tv: "TV",
  ova: "OVA",
  ona: "ONA",
  movie: "Film",
  special: "Special",
  music: "Music",
  unknown: "Sconosciuto",
};

export function getCoverUrl(anime: AnimeNode): string {
  return (
    anime.main_picture?.large ??
    anime.main_picture?.medium ??
    "https://cdn.myanimelist.net/images/spacer.gif"
  );
}

export function getCurrentSeason(): { year: number; season: string } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month <= 3) return { year, season: "winter" };
  if (month <= 6) return { year, season: "spring" };
  if (month <= 9) return { year, season: "summer" };
  return { year, season: "fall" };
}

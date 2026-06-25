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
  studios?: Studio[];
  source?: string;
  broadcast?: Broadcast;
}

export interface Studio {
  id: number;
  name: string;
}

export interface Broadcast {
  day_of_the_week?: string;
  start_time?: string;
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
  gender?: string;
  location?: string;
  birthday?: string;
  time_zone?: string;
  about?: string;
  anime_statistics?: AnimeStatistics;
}

export interface UpdateUserProfileRequest {
  gender?: string;
  location?: string;
  birthday?: string;
  time_zone?: string;
  about?: string;
}

export interface AiringCalendarEntry {
  anime_id: number;
  title: string;
  main_picture?: Picture;
  num_episodes?: number;
  num_episodes_watched?: number;
  broadcast_day: string;
  broadcast_time?: string;
  next_episode?: number;
}

export interface ApiResponse<T> {
  data: T;
  from_cache: boolean;
  cache_expires_at?: string | null;
}

export interface AppPreferences {
  episode_notifications: boolean;
  show_streaming_search_links: boolean;
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
  exclude_genres?: string;
  min_episodes?: number;
  max_episodes?: number;
}

export interface AnimelistLoadProgress {
  loaded: number;
  total?: number;
  done?: boolean;
}

export type ListStatus =
  | "watching"
  | "completed"
  | "plan_to_watch"
  | "dropped"
  | "on_hold";

export type ListTabFilter = "all" | ListStatus;

export type NavTab = "home" | "archive" | "list" | "calendar";

export type ArchiveSort =
  | "mean"
  | "title"
  | "start_date"
  | "popularity";

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

export { MAL_GENRES as GENRES, GENRE_BY_ID, GENRE_GROUPS } from "@/data/malGenres";
export type { MalGenre, GenreGroupId } from "@/data/malGenres";

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

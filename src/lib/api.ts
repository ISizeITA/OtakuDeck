import { invoke } from "@tauri-apps/api/core";
import type {
  AnimeListResponse,
  AnimeNode,
  AnimeSearchResponse,
  ListStatus,
  SearchAnimeParams,
  UserProfile,
} from "@/types/mal";
import type { AuthSession } from "@/hooks/useAuth";

export const api = {
  getSession: () => invoke<AuthSession | null>("get_auth_session"),
  logout: () => invoke<void>("logout"),
  searchAnime: (params: SearchAnimeParams) =>
    invoke<AnimeSearchResponse>("search_anime", { params }),
  getAnimeDetails: (id: number) =>
    invoke<AnimeNode>("get_anime_details", { id }),
  getAnimeRanking: (rankingType: string, limit?: number, offset?: number) =>
    invoke<AnimeSearchResponse>("get_anime_ranking", {
      rankingType,
      limit,
      offset,
    }),
  getSeasonalAnime: (
    year: number,
    season: string,
    limit?: number,
    offset?: number,
  ) =>
    invoke<AnimeSearchResponse>("get_seasonal_anime", {
      year,
      season,
      limit,
      offset,
    }),
  getUserAnimelist: (status?: ListStatus, limit?: number, offset?: number) =>
    invoke<AnimeListResponse>("get_user_animelist", { status, limit, offset }),
  getUserProfile: () => invoke<UserProfile>("get_user_profile"),
  getSuggestions: () => invoke<AnimeNode[]>("get_suggestions"),
  getAiringAnime: (limit?: number, offset?: number) =>
    invoke<AnimeSearchResponse>("get_airing_anime", { limit, offset }),
  updateListStatus: (
    animeId: number,
    status?: string,
    score?: number,
    numWatchedEpisodes?: number,
    totalEpisodes?: number,
  ) =>
    invoke("update_anime_list_status", {
      animeId,
      status,
      score,
      numWatchedEpisodes,
      totalEpisodes,
    }),
  translateSynopsis: (animeId: number, text: string, targetLang: string) =>
    invoke<string>("translate_synopsis", { animeId, text, targetLang }),
  getTranslateConfig: () =>
    invoke<TranslateConfig>("get_translate_config"),
  saveTranslateConfig: (config: TranslateConfig) =>
    invoke<void>("save_translate_config", { config }),
  checkTranslateService: () => invoke<string[]>("check_translate_service"),
  getMyMemoryQuota: (mymemoryEmail?: string) =>
    invoke<MyMemoryQuota>("get_mymemory_quota", {
      mymemoryEmail: mymemoryEmail?.trim() || null,
    }),
};

export interface MyMemoryQuota {
  charactersUsed: number;
  charactersLimit: number;
  charactersRemaining: number;
  percentUsed: number;
  percentRemaining: number;
  hasEmail: boolean;
}

export type TranslateProvider = "mymemory" | "deepl" | "google";

export interface TranslateConfig {
  provider: TranslateProvider;
  apiKey?: string | null;
  apiUrl?: string | null;
  mymemoryEmail?: string | null;
}

import { invoke } from "@tauri-apps/api/core";
import type {
  AiringCalendarEntry,
  AnimeListEntry,
  AnimeListResponse,
  AnimeNode,
  AnimeSearchResponse,
  ApiResponse,
  AppPreferences,
  HomeFeed,
  ListStatus,
  SearchAnimeParams,
  UpdateUserProfileRequest,
  UserProfile,
} from "@/types/mal";
import type { AuthSession } from "@/hooks/useAuth";
import type { TranslateConfig, MyMemoryQuota } from "@/lib/api.types";

export type { TranslateConfig, MyMemoryQuota, TranslateProvider } from "@/lib/api.types";

export const api = {
  getSession: () => invoke<AuthSession | null>("get_auth_session"),
  logout: () => invoke<void>("logout"),
  getPlatform: () => invoke<string>("get_platform"),
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
    forceRefresh?: boolean,
  ) =>
    invoke<ApiResponse<AnimeSearchResponse>>("get_seasonal_anime", {
      year,
      season,
      limit,
      offset,
      forceRefresh,
    }),
  getUserAnimelist: (status?: ListStatus, limit?: number, offset?: number) =>
    invoke<AnimeListResponse>("get_user_animelist", { status, limit, offset }),
  getUserAnimelistAll: (forceRefresh?: boolean) =>
    invoke<ApiResponse<AnimeListEntry[]>>("get_user_animelist_all", {
      forceRefresh,
    }),
  getUserProfile: () => invoke<ApiResponse<UserProfile>>("get_user_profile"),
  updateUserProfile: (update: UpdateUserProfileRequest) =>
    invoke<UserProfile>("update_user_profile", { update }),
  getSuggestions: (forceRefresh?: boolean) =>
    invoke<ApiResponse<AnimeNode[]>>("get_suggestions", { forceRefresh }),
  getAiringAnime: (limit?: number, offset?: number, forceRefresh?: boolean) =>
    invoke<ApiResponse<AnimeSearchResponse>>("get_airing_anime", {
      limit,
      offset,
      forceRefresh,
    }),
  getAiringCalendar: (forceRefresh?: boolean) =>
    invoke<ApiResponse<AiringCalendarEntry[]>>("get_airing_calendar", {
      forceRefresh,
    }),
  getHomeFeed: (forceRefresh?: boolean) =>
    invoke<ApiResponse<HomeFeed>>("get_home_feed", { forceRefresh }),
  getContinueWatching: (forceRefresh?: boolean) =>
    invoke<ApiResponse<AnimeListEntry[]>>("get_continue_watching", {
      forceRefresh,
    }),
  getAppPreferences: () => invoke<AppPreferences>("get_app_preferences"),
  saveAppPreferences: (prefs: AppPreferences) =>
    invoke<void>("save_app_preferences", { prefs }),
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

import {
  dayKeyToIndex,
  formatBroadcastLocal,
  getLocalDayIndex,
  isBroadcastDayToday,
  parseBroadcastMinutes,
} from "@/lib/broadcastTime";
import type { AiringCalendarEntry, AnimeNode } from "@/types/mal";

export function hasNewEpisodeFromCalendar(
  entry: AiringCalendarEntry,
  now = new Date(),
): boolean {
  const next = entry.next_episode;
  if (next === undefined) return false;
  const watched = entry.num_episodes_watched ?? 0;
  if (next <= watched) return false;
  if (entry.list_status !== "watching" && entry.list_status !== "on_hold") {
    return false;
  }

  const broadcastIdx = dayKeyToIndex(entry.broadcast_day);
  if (broadcastIdx === 99) return false;

  const todayIdx = getLocalDayIndex(now);
  if (todayIdx > broadcastIdx) return true;
  if (todayIdx < broadcastIdx) return false;

  const localTime = formatBroadcastLocal(entry.broadcast_time, now);
  if (!localTime) return true;
  const broadcastMinutes = parseBroadcastMinutes(localTime);
  if (broadcastMinutes === null) return true;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= broadcastMinutes;
}

export function buildNewEpisodeIdSet(ids: number[]): Set<number> {
  return new Set(ids);
}

export function isNewEpisode(
  animeId: number,
  newEpisodeIds: Set<number>,
): boolean {
  return newEpisodeIds.has(animeId);
}

/** Fallback when only list node data is available (no calendar row). */
export function hasNewEpisodeFromNode(anime: AnimeNode, now = new Date()): boolean {
  if (anime.status !== "currently_airing") return false;
  const status = anime.my_list_status?.status;
  if (status !== "watching" && status !== "on_hold") return false;
  const watched = anime.my_list_status?.num_episodes_watched ?? 0;
  if (watched === 0) return false;
  const total = anime.num_episodes ?? 0;
  if (total > 0 && watched >= total) return false;

  const day = anime.broadcast?.day_of_the_week;
  if (!day) return false;

  const broadcastIdx = dayKeyToIndex(day);
  if (broadcastIdx === 99) return false;
  const todayIdx = getLocalDayIndex(now);
  if (todayIdx > broadcastIdx) return true;
  if (todayIdx < broadcastIdx) return false;
  if (!isBroadcastDayToday(day, now)) return false;

  const localTime = formatBroadcastLocal(anime.broadcast?.start_time, now);
  if (!localTime) return true;
  const broadcastMinutes = parseBroadcastMinutes(localTime);
  if (broadcastMinutes === null) return true;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= broadcastMinutes;
}

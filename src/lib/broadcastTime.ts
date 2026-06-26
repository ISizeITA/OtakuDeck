/** MAL broadcast times are reported in Japan Standard Time (UTC+9). */
const JST_OFFSET_MINUTES = 9 * 60;

const DAY_TO_INDEX: Record<string, number> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

export function getLocalDayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

export function getLocalDayKey(date = new Date()): string {
  const keys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  return keys[getLocalDayIndex(date)];
}

export function isBroadcastDayToday(broadcastDay: string, date = new Date()): boolean {
  return broadcastDay.toLowerCase() === getLocalDayKey(date);
}

export function parseBroadcastMinutes(time?: string): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Convert a JST broadcast clock time to the user's local HH:mm for display. */
export function formatBroadcastLocal(time?: string, date = new Date()): string | null {
  const jstMinutes = parseBroadcastMinutes(time);
  if (jstMinutes === null) return null;

  const localOffset = -date.getTimezoneOffset();
  const utcMinutes = jstMinutes - JST_OFFSET_MINUTES;
  let localMinutes = utcMinutes + localOffset;
  localMinutes = ((localMinutes % (24 * 60)) + 24 * 60) % (24 * 60);

  const hour = Math.floor(localMinutes / 60);
  const minute = localMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatBroadcastDisplay(
  time?: string,
  locale: string = "en",
): string {
  const local = formatBroadcastLocal(time);
  if (!local) return time ?? "";
  const label = locale.startsWith("it") ? "ora locale" : "local";
  return `${local} (${label})`;
}

export function dayKeyToIndex(day: string): number {
  return DAY_TO_INDEX[day.toLowerCase()] ?? 99;
}

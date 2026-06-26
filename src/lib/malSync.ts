import type { Locale } from "@/i18n/translations";

export function formatMalSyncTime(
  cachedAt: string | null | undefined,
  locale: Locale,
): string {
  if (!cachedAt) return "—";
  const date = new Date(cachedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "it" ? "it-IT" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

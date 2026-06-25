import { useCallback } from "react";
import { getGenreLabel } from "@/i18n/genreLabels";
import { useTranslation } from "@/context/SettingsContext";
import type { TranslationKey } from "@/i18n/translations";
import type { ListStatus } from "@/types/mal";

export function useMalLabels() {
  const { t, locale } = useTranslation();

  const listStatus = useCallback(
    (status: ListStatus) => t(`listStatus.${status}` as TranslationKey),
    [t],
  );

  const mediaType = useCallback(
    (type: string) => {
      const key = `mediaType.${type || "all"}` as TranslationKey;
      return t(key);
    },
    [t],
  );

  const animeStatus = useCallback(
    (status: string) => t(`animeStatus.${status}` as TranslationKey),
    [t],
  );

  const season = useCallback(
    (name: string) => t(`season.${name}` as TranslationKey),
    [t],
  );

  const genre = useCallback(
    (id: number, fallback?: string) => {
      const name = fallback ?? String(id);
      const localized = getGenreLabel(locale, id, name);
      if (localized !== name) return localized;
      const key = `genre.${id}` as TranslationKey;
      const translated = t(key);
      return translated === key ? name : translated;
    },
    [t, locale],
  );

  return { listStatus, mediaType, animeStatus, season, genre };
}

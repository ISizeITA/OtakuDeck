import { useCallback } from "react";
import { useTranslation } from "@/context/SettingsContext";
import type { TranslationKey } from "@/i18n/translations";
import type { ListStatus } from "@/types/mal";

export function useMalLabels() {
  const { t } = useTranslation();

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
      const key = `genre.${id}` as TranslationKey;
      const translated = t(key);
      return translated === key ? (fallback ?? translated) : translated;
    },
    [t],
  );

  return { listStatus, mediaType, animeStatus, season, genre };
}

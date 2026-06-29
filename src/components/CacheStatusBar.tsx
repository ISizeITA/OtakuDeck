import { useTranslation } from "@/context/SettingsContext";
import { formatMalSyncTime } from "@/lib/malSync";
import "@/styles/components/cache-status.css";

interface CacheStatusBarProps {
  fromCache: boolean;
  cachedAt?: string | null;
  cacheExpiresAt?: string | null;
  loading?: boolean;
}

export function CacheStatusBar({
  fromCache,
  cachedAt,
  cacheExpiresAt,
  loading = false,
}: CacheStatusBarProps) {
  const { t, locale } = useTranslation();

  if (loading) {
    return (
      <div className="cache-status cache-status--loading" role="status">
        <span className="pill-button__spinner cache-status__spinner" />
        <span>{t("common.refreshing")}</span>
      </div>
    );
  }

  if (!fromCache && !cachedAt) return null;

  const savedLabel = cachedAt
    ? formatMalSyncTime(cachedAt, locale)
    : null;

  const expiryLabel =
    fromCache && cacheExpiresAt
      ? formatMalSyncTime(cacheExpiresAt, locale)
      : null;

  return (
    <div
      className={`cache-status ${fromCache ? "cache-status--offline" : "cache-status--online"}`}
      role="status"
    >
      <span className="cache-status__dot" aria-hidden="true" />
      <span className="cache-status__text">
        {fromCache ? t("common.offlineCacheShort") : t("common.onlineFresh")}
        {savedLabel && (
          <>
            {" · "}
            {t("common.dataSavedAt", { time: savedLabel })}
          </>
        )}
        {expiryLabel && (
          <>
            {" · "}
            {t("common.cacheValidUntil", { time: expiryLabel })}
          </>
        )}
      </span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/offline-banner.css";

interface OfflineBannerProps {
  visible: boolean;
  expiresAt?: string | null;
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function OfflineBanner({ visible, expiresAt }: OfflineBannerProps) {
  const { t } = useTranslation();
  const [timerLabel, setTimerLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !expiresAt) {
      setTimerLabel(null);
      return;
    }

    const expiry = expiresAt;

    function tick() {
      const remaining = new Date(expiry).getTime() - Date.now();
      if (remaining <= 0) {
        setTimerLabel(t("common.cacheExpired"));
      } else {
        setTimerLabel(formatRemaining(remaining));
      }
    }

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [visible, expiresAt, t]);

  if (!visible) return null;

  return (
    <div className="offline-banner" role="status">
      <span className="offline-banner__text">{t("common.offlineCache")}</span>
      {timerLabel && (
        <span
          className={`offline-banner__timer${timerLabel === t("common.cacheExpired") ? " offline-banner__timer--expired" : ""}`}
          aria-label={t("common.cacheExpiresAt", { time: timerLabel })}
        >
          {timerLabel}
        </span>
      )}
    </div>
  );
}

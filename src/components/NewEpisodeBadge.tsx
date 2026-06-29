import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/new-episode-badge.css";

interface NewEpisodeBadgeProps {
  className?: string;
}

export function NewEpisodeBadge({ className = "" }: NewEpisodeBadgeProps) {
  const { t } = useTranslation();
  return (
    <span
      className={`new-episode-badge ${className}`.trim()}
      title={t("badge.newEpisodeHint")}
    >
      {t("badge.newEpisode")}
    </span>
  );
}

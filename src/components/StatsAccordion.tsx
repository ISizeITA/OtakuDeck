import { useState } from "react";
import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/stats.css";
import type { AnimeStatistics } from "@/types/mal";

interface StatsAccordionProps {
  stats: AnimeStatistics;
  listCount: number;
}

export function StatsAccordion({ stats, listCount }: StatsAccordionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const totalEpisodes = stats.num_episodes ?? 0;
  const totalHours = Math.round((stats.num_days ?? 0) * 24);
  const meanScore = stats.mean_score?.toFixed(1) ?? "—";

  return (
    <div className={`stats-accordion ${open ? "stats-accordion--open" : ""}`}>
      <button
        type="button"
        className="stats-accordion__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="stats-accordion__title">{t("list.stats")}</span>
        <svg
          className="stats-accordion__chevron"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="stats-accordion__body">
        <div className="stats-accordion__inner">
          <div className="stats-accordion__grid">
            <div className="stats-accordion__stat">
              <span className="stats-accordion__value">{totalEpisodes.toLocaleString()}</span>
              <span className="stats-accordion__label">{t("list.statsEpisodes")}</span>
            </div>
            <div className="stats-accordion__stat">
              <span className="stats-accordion__value">{totalHours.toLocaleString()}</span>
              <span className="stats-accordion__label">{t("list.statsHours")}</span>
            </div>
            <div className="stats-accordion__stat">
              <span className="stats-accordion__value">{meanScore}</span>
              <span className="stats-accordion__label">{t("list.statsMean")}</span>
            </div>
            <div className="stats-accordion__stat">
              <span className="stats-accordion__value">{listCount.toLocaleString()}</span>
              <span className="stats-accordion__label">{t("list.statsTotal")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

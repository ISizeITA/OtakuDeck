import "@/styles/components/nav.css";
import { useTranslation } from "@/context/SettingsContext";
import type { NavTab } from "@/types/mal";

const TAB_IDS: NavTab[] = ["home", "archive", "list", "calendar"];

interface PillNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export function PillNav({ activeTab, onTabChange }: PillNavProps) {
  const { t } = useTranslation();

  return (
    <nav className="pill-nav" aria-label={t("nav.aria")}>
      {TAB_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={`pill-nav__item ${activeTab === id ? "pill-nav__item--active" : ""}`}
          onClick={() => onTabChange(id)}
          aria-current={activeTab === id ? "page" : undefined}
        >
          {t(`nav.${id}`)}
        </button>
      ))}
    </nav>
  );
}

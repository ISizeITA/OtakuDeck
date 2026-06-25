import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/search.css";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.searchPlaceholder");

  return (
    <div className="search-bar">
      <svg className="search-bar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        className="search-bar__input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={t("common.searchAnime")}
      />
    </div>
  );
}

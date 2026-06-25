import { FilterChips } from "@/components/FilterChips";
import { TranslateSettings } from "@/components/TranslateSettings";
import { useSettings } from "@/context/SettingsContext";
import type { LanguagePreference } from "@/context/SettingsContext";
import "@/styles/components/settings.css";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { theme, toggleTheme, language, setLanguage, t } = useSettings();

  const languageOptions: { id: LanguagePreference; label: string }[] = [
    { id: "system", label: t("settings.languageSystem") },
    { id: "it", label: t("settings.languageIt") },
    { id: "en", label: t("settings.languageEn") },
  ];

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <header className="settings-panel__header">
          <h2 id="settings-title" className="settings-panel__title">
            {t("settings.title")}
          </h2>
          <button
            type="button"
            className="settings-panel__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <div className="settings-panel__body">
          <section className="settings-section">
            <h3 className="settings-section__title">{t("settings.appearance")}</h3>

            <div className="settings-row">
              <div className="settings-row__info">
                <span className="settings-row__label">{t("settings.theme")}</span>
                <span className="settings-row__hint">
                  {theme === "dark" ? t("settings.themeDark") : t("settings.themeLight")}
                </span>
              </div>
              <button
                type="button"
                className={`theme-switch ${theme === "light" ? "theme-switch--light" : ""}`}
                role="switch"
                aria-checked={theme === "light"}
                aria-label={t("settings.theme")}
                onClick={toggleTheme}
              >
                <span className="theme-switch__track">
                  <span className="theme-switch__thumb" />
                </span>
                <span className="theme-switch__icons" aria-hidden="true">
                  <span className="theme-switch__icon">🌙</span>
                  <span className="theme-switch__icon">☀️</span>
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">{t("settings.general")}</h3>
            <FilterChips
              label={t("settings.language")}
              chips={languageOptions}
              activeId={language}
              onChange={(id) => setLanguage(id as LanguagePreference)}
            />
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">{t("settings.translation")}</h3>
            <TranslateSettings />
          </section>

          <section className="settings-section settings-section--info">
            <p className="settings-panel__text">{t("settings.syncInfo")}</p>
            <p className="settings-panel__text settings-panel__text--muted">
              {t("settings.apiInfo")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

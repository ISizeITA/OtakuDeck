import { useEffect, useState } from "react";
import { FilterChips } from "@/components/FilterChips";
import { ShortcutRecorder } from "@/components/ShortcutRecorder";
import { TranslateSettings } from "@/components/TranslateSettings";
import { useSettings } from "@/context/SettingsContext";
import type { LanguagePreference } from "@/context/SettingsContext";
import { api } from "@/lib/api";
import type { AppPreferences } from "@/types/mal";
import "@/styles/components/settings.css";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    theme,
    cycleTheme,
    language,
    setLanguage,
    searchShortcut,
    setSearchShortcut,
    resetSearchShortcut,
    t,
  } = useSettings();
  const [prefs, setPrefs] = useState<AppPreferences>({
    episode_notifications: false,
    show_streaming_search_links: false,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);

  useEffect(() => {
    api
      .getAppPreferences()
      .then(setPrefs)
      .finally(() => setPrefsLoading(false));
  }, []);

  const languageOptions: { id: LanguagePreference; label: string }[] = [
    { id: "system", label: t("settings.languageSystem") },
    { id: "it", label: t("settings.languageIt") },
    { id: "en", label: t("settings.languageEn") },
  ];

  const toggleNotifications = async () => {
    const next = { ...prefs, episode_notifications: !prefs.episode_notifications };
    setPrefs(next);
    try {
      await api.saveAppPreferences(next);
      if (next.episode_notifications) {
        await api.getAiringCalendar();
      }
    } catch {
      setPrefs(prefs);
    }
  };

  const toggleStreamingLinks = async () => {
    const next = {
      ...prefs,
      show_streaming_search_links: !prefs.show_streaming_search_links,
    };
    setPrefs(next);
    try {
      await api.saveAppPreferences(next);
    } catch {
      setPrefs(prefs);
    }
  };

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
                  {theme === "dark"
                    ? t("settings.themeDark")
                    : theme === "light"
                      ? t("settings.themeLight")
                      : t("settings.themeAmoled")}
                </span>
              </div>
              <button
                type="button"
                className={`theme-switch ${theme !== "dark" ? "theme-switch--light" : ""}`}
                role="switch"
                aria-checked={theme !== "dark"}
                aria-label={t("settings.theme")}
                onClick={cycleTheme}
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
            <h3 className="settings-section__title">{t("settings.shortcuts")}</h3>
            <div className="settings-row settings-row--stacked">
              <div className="settings-row__info">
                <span className="settings-row__label">{t("settings.globalSearch")}</span>
                <span className="settings-row__hint">{t("settings.globalSearchHint")}</span>
              </div>
              <ShortcutRecorder
                value={searchShortcut}
                onChange={setSearchShortcut}
                onReset={resetSearchShortcut}
              />
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">{t("settings.notifications")}</h3>
            <div className="settings-row">
              <div className="settings-row__info">
                <span className="settings-row__label">
                  {t("settings.episodeNotifications")}
                </span>
                <span className="settings-row__hint">
                  {t("settings.episodeNotificationsHint")}
                </span>
              </div>
              <button
                type="button"
                className={`theme-switch ${prefs.episode_notifications ? "theme-switch--light" : ""}`}
                role="switch"
                aria-checked={prefs.episode_notifications}
                aria-label={t("settings.episodeNotifications")}
                disabled={prefsLoading}
                onClick={() => void toggleNotifications()}
              >
                <span className="theme-switch__track">
                  <span className="theme-switch__thumb" />
                </span>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">{t("settings.externalLinks")}</h3>
            <div className="settings-row">
              <div className="settings-row__info">
                <span className="settings-row__label">
                  {t("settings.streamingSearchLinks")}
                </span>
                <span className="settings-row__hint">
                  {t("settings.streamingSearchLinksHint")}
                </span>
              </div>
              <button
                type="button"
                className={`theme-switch ${prefs.show_streaming_search_links ? "theme-switch--light" : ""}`}
                role="switch"
                aria-checked={prefs.show_streaming_search_links}
                aria-label={t("settings.streamingSearchLinks")}
                disabled={prefsLoading}
                onClick={() => void toggleStreamingLinks()}
              >
                <span className="theme-switch__track">
                  <span className="theme-switch__thumb" />
                </span>
              </button>
            </div>
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

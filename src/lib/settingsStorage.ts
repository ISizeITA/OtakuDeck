import type { LanguagePreference, Theme } from "@/context/SettingsContext";

const THEME_KEY = "otakudeck-theme";
const LANGUAGE_KEY = "otakudeck-language";

export function loadStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "amoled") return stored;
  return "dark";
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadStoredLanguage(): LanguagePreference {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "it" || stored === "system") return stored;
  return "system";
}

export function saveLanguage(language: LanguagePreference) {
  localStorage.setItem(LANGUAGE_KEY, language);
}

export function applyThemeToDocument(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

const ONBOARDING_KEY = "otakudeck-onboarding-done";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, "1");
}

export function applyInitialSettings() {
  applyThemeToDocument(loadStoredTheme());
}

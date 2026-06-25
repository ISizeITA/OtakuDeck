import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectSystemLocale,
  translate,
  type Locale,
  type TranslationKey,
} from "@/i18n/translations";
import {
  applyThemeToDocument,
  loadStoredLanguage,
  loadStoredTheme,
  saveLanguage,
  saveTheme,
} from "@/lib/settingsStorage";

export type Theme = "dark" | "light";
export type LanguagePreference = "system" | Locale;

interface SettingsContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  language: LanguagePreference;
  setLanguage: (language: LanguagePreference) => void;
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function resolveLocale(language: LanguagePreference): Locale {
  if (language === "system") return detectSystemLocale();
  return language;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadStoredTheme());
  const [language, setLanguageState] = useState<LanguagePreference>(() =>
    loadStoredLanguage(),
  );

  const locale = useMemo(() => resolveLocale(language), [language]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    saveTheme(next);
    applyThemeToDocument(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const setLanguage = useCallback((next: LanguagePreference) => {
    setLanguageState(next);
    saveLanguage(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      language,
      setLanguage,
      locale,
      t,
    }),
    [theme, setTheme, toggleTheme, language, setLanguage, locale, t],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale } = useSettings();
  return { t, locale };
}

import { useCallback, useEffect, useState } from "react";
import { FilterChips } from "@/components/FilterChips";
import { PillButton } from "@/components/PillButton";
import { useTranslation } from "@/context/SettingsContext";
import { api, type MyMemoryQuota, type TranslateConfig, type TranslateProvider } from "@/lib/api";
import "@/styles/components/settings.css";

function normalizeProvider(value: string): TranslateProvider {
  if (value === "deepl" || value === "google") return value;
  return "mymemory";
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function MyMemoryQuotaMeter({
  quota,
  label,
  summary,
}: {
  quota: MyMemoryQuota;
  label: string;
  summary: string;
}) {
  const low = quota.percentRemaining <= 10;

  return (
    <div className="translate-quota">
      <div className="translate-quota__header">
        <span className="translate-quota__label">{label}</span>
        <span className={`translate-quota__value ${low ? "translate-quota__value--low" : ""}`}>
          {summary}
        </span>
      </div>
      <div className="translate-quota__track" role="progressbar" aria-valuenow={quota.percentRemaining} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`translate-quota__fill ${low ? "translate-quota__fill--low" : ""}`}
          style={{ width: `${quota.percentRemaining}%` }}
        />
      </div>
      <div className="translate-quota__meta">
        <span>
          {quota.charactersUsed.toLocaleString()} / {quota.charactersLimit.toLocaleString()}
        </span>
        <span>{formatPercent(quota.percentRemaining)}%</span>
      </div>
    </div>
  );
}

export function TranslateSettings() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<TranslateProvider>("mymemory");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [mymemoryEmail, setMymemoryEmail] = useState("");
  const [quota, setQuota] = useState<MyMemoryQuota | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refreshQuota = useCallback(async (email?: string) => {
    try {
      const data = await api.getMyMemoryQuota(email);
      setQuota(data);
    } catch {
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    api
      .getTranslateConfig()
      .then((cfg) => {
        setProvider(normalizeProvider(cfg.provider));
        setApiKey(cfg.apiKey ?? "");
        setApiUrl(cfg.apiUrl ?? "");
        setMymemoryEmail(cfg.mymemoryEmail ?? "");
        if (normalizeProvider(cfg.provider) === "mymemory") {
          void refreshQuota(cfg.mymemoryEmail ?? undefined);
        }
      })
      .catch(() => {});
  }, [refreshQuota]);

  useEffect(() => {
    if (provider !== "mymemory") {
      setQuota(null);
      return;
    }
    const timer = setTimeout(() => {
      void refreshQuota(mymemoryEmail.trim() || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [provider, mymemoryEmail, refreshQuota]);

  const buildConfig = (): TranslateConfig => ({
    provider,
    apiKey: apiKey.trim() || null,
    apiUrl: apiUrl.trim() || null,
    mymemoryEmail: mymemoryEmail.trim() || null,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.saveTranslateConfig(buildConfig());
      setSaved(true);
      setStatus("idle");
      setStatusMessage(null);
      if (provider === "mymemory") {
        await refreshQuota(mymemoryEmail.trim() || undefined);
      }
    } catch (err) {
      setStatus("error");
      setStatusMessage(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setSaved(false);
    setStatus("idle");
    setStatusMessage(null);
    try {
      await api.saveTranslateConfig(buildConfig());
      await api.checkTranslateService();
      setStatus("ok");
      setStatusMessage(t("settings.translateOk"));
      if (provider === "mymemory") {
        await refreshQuota(mymemoryEmail.trim() || undefined);
      }
    } catch {
      setStatus("error");
      setStatusMessage(t("settings.translateFail"));
    } finally {
      setTesting(false);
    }
  };

  const providerOptions: { id: TranslateProvider; label: string }[] = [
    { id: "mymemory", label: t("settings.translateProviderMyMemory") },
    { id: "deepl", label: t("settings.translateProviderDeepL") },
    { id: "google", label: t("settings.translateProviderGoogle") },
  ];

  const needsApiKey = provider === "deepl" || provider === "google";

  return (
    <div className="translate-settings">
      <p className="settings-panel__text settings-panel__text--muted">
        {t("settings.translateInfo")}
      </p>

      <FilterChips
        label={t("settings.translateProvider")}
        chips={providerOptions}
        activeId={provider}
        onChange={(id) => setProvider(id as TranslateProvider)}
      />

      {provider === "mymemory" ? (
        <>
          {quota && (
            <MyMemoryQuotaMeter
              quota={quota}
              label={t("settings.mymemoryQuotaLabel")}
              summary={t("settings.mymemoryQuotaSummary", {
                remaining: quota.charactersRemaining.toLocaleString(),
                percent: formatPercent(quota.percentRemaining),
              })}
            />
          )}

          <label className="translate-settings__field">
            <span className="translate-settings__label">{t("settings.translateMyMemoryEmail")}</span>
            <span className="translate-settings__hint">{t("settings.translateMyMemoryEmailHint")}</span>
            <input
              className="translate-settings__input"
              type="email"
              value={mymemoryEmail}
              onChange={(e) => setMymemoryEmail(e.target.value)}
              spellCheck={false}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <p className="settings-panel__text settings-panel__text--muted">
            {t("settings.mymemoryQuotaReset")}
          </p>
        </>
      ) : (
        <>
          <label className="translate-settings__field">
            <span className="translate-settings__label">{t("settings.translateApiKey")}</span>
            <span className="translate-settings__hint">
              {provider === "deepl"
                ? t("settings.translateDeepLKeyHint")
                : t("settings.translateGoogleKeyHint")}
            </span>
            <input
              className="translate-settings__input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>

          <label className="translate-settings__field">
            <span className="translate-settings__label">{t("settings.translateApiUrl")}</span>
            <span className="translate-settings__hint">
              {provider === "deepl"
                ? t("settings.translateDeepLUrlHint")
                : t("settings.translateGoogleUrlHint")}
            </span>
            <input
              className="translate-settings__input"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              spellCheck={false}
              placeholder={
                provider === "deepl"
                  ? "https://api-free.deepl.com/v2/translate"
                  : "https://translation.googleapis.com/language/translate/v2"
              }
            />
          </label>
        </>
      )}

      {needsApiKey && (
        <p className="settings-panel__text settings-panel__text--muted">
          {t("settings.translateApiNote")}
        </p>
      )}

      <div className="translate-settings__actions">
        <PillButton variant="secondary" onClick={handleTest} loading={testing} disabled={testing}>
          {testing ? t("settings.translateTesting") : t("settings.translateTest")}
        </PillButton>
        <PillButton variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
          {t("settings.translateSave")}
        </PillButton>
      </div>

      {saved && (
        <p className="translate-settings__status translate-settings__status--ok">
          {t("settings.translateSaved")}
        </p>
      )}
      {statusMessage && (
        <p
          className={`translate-settings__status ${status === "ok" ? "translate-settings__status--ok" : "translate-settings__status--error"}`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
}

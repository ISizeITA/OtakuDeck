import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { PillButton } from "@/components/PillButton";
import { OtakuDeckLogo } from "@/components/OtakuDeckLogo";
import { SettingsPanel } from "@/components/SettingsPanel";
import "@/styles/components/account-switcher.css";
import { useTranslation } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";

function MalIcon() {
  return (
    <svg className="pill-button__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

function DeckLogo() {
  return <OtakuDeckLogo className="landing__logo-icon" />;
}

function PublisherSetup({ onConfigured }: { onConfigured: () => void }) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("save_mal_client_id", { clientId: clientId.trim() });
      onConfigured();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="landing__setup" role="note">
      <strong>{t("landing.setupTitle")}</strong>
      <p style={{ marginTop: 8, marginBottom: 12 }}>{t("landing.setupIntro")}</p>
      <ol>
        <li>
          {t("landing.setupStep1")}{" "}
          <a href="https://myanimelist.net/apiconfig" target="_blank" rel="noopener noreferrer">
            myanimelist.net/apiconfig
          </a>{" "}
          {t("landing.setupStep1Type")}
        </li>
        <li>
          {t("landing.setupStep2")} <code>http://127.0.0.1:14568/callback</code>
        </li>
        <li>{t("landing.setupStep3")}</li>
      </ol>
      <input
        className="landing__setup-input"
        type="text"
        placeholder={t("landing.clientIdPlaceholder")}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        spellCheck={false}
      />
      <PillButton
        variant="primary"
        onClick={handleSave}
        loading={saving}
        disabled={saving || clientId.trim().length < 10}
      >
        {t("landing.saveContinue")}
      </PillButton>
      {error && <p className="landing__error">{error}</p>}
    </div>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const {
    login,
    isLoading,
    error,
    isMobile,
    accounts,
    accountsLoading,
    accountBusyId,
    switchAccount,
    addAccount,
    removeAccount,
  } = useAuth();
  const [ready, setReady] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const checkReady = () => {
    invoke<{ clientIdConfigured: boolean }>("get_auth_config")
      .then((cfg) => setReady(cfg.clientIdConfigured))
      .catch(() => setReady(false));
  };

  useEffect(() => {
    checkReady();
  }, []);

  const handleLogin = () => login();
  const hasSavedAccounts = accounts.length > 0;

  if (ready === null) {
    return (
      <main className="landing">
        <div className="landing__card">
          <span className="pill-button__spinner page__spinner" />
        </div>
      </main>
    );
  }

  return (
    <main className="landing">
      <div className="landing__card">
        <div className="landing__logo">
          <DeckLogo />
        </div>

        <h1 className="landing__title">{t("app.name")}</h1>
        <p className="landing__subtitle">{t("landing.subtitle")}</p>

        {!ready ? (
          <PublisherSetup onConfigured={() => setReady(true)} />
        ) : hasSavedAccounts ? (
          <>
            <p className="landing__subtitle">{t("accounts.title")}</p>
            <AccountSwitcher
              accounts={accounts}
              loading={accountsLoading}
              busyId={accountBusyId}
              onSwitch={switchAccount}
              onAdd={addAccount}
              onRemove={removeAccount}
              onSignIn={(id) => login({ accountId: id })}
            />
          </>
        ) : (
          <>
            <div className="landing__actions">
              <PillButton variant="primary" onClick={handleLogin} loading={isLoading} disabled={isLoading}>
                <MalIcon />
                {t("landing.login")}
              </PillButton>
            </div>

            {isLoading && (
              <p className="landing__status" role="status">
                <span className="landing__status-dot" />
                {isMobile ? t("landing.statusMobile") : t("landing.statusDesktop")}
              </p>
            )}
          </>
        )}

        {error && (
          <p className="landing__error" role="alert">
            {error}
          </p>
        )}

        <p className="landing__footer">
          {t("landing.footer")}{" "}
          <a
            href="https://myanimelist.net/apiconfig/references/api/v2"
            target="_blank"
            rel="noopener noreferrer"
          >
            MyAnimeList API
          </a>
          {" · "}
          <button
            type="button"
            className="landing__settings-link"
            onClick={() => setShowSettings(true)}
          >
            {t("user.settings")}
          </button>
        </p>
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </main>
  );
}

import { useEffect, useRef, useState } from "react";
import "@/styles/components/layout.css";
import "@/styles/components/nav.css";
import { OtakuDeckLogo } from "@/components/OtakuDeckLogo";
import { PillNav } from "@/components/PillNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { RefreshButton } from "@/components/RefreshButton";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UserMenu } from "@/components/UserMenu";
import { useRefresh } from "@/context/RefreshContext";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { GLOBAL_SEARCH_OPEN_EVENT } from "@/lib/keyboardShortcut";
import { ProfilePage } from "@/pages/ProfilePage";
import type { NavTab } from "@/types/mal";

interface MainLayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function MainLayout({ activeTab, onTabChange, children }: MainLayoutProps) {
  const {
    logout,
    accounts,
    accountsLoading,
    accountBusyId,
    switchAccount,
    addAccount,
    removeAccount,
    login,
  } = useAuth();
  const { t } = useSettings();
  const { triggerRefresh, isRefreshing } = useRefresh();
  const [username, setUsername] = useState(t("user.profile"));
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const logoPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSearch = () => {
    window.dispatchEvent(new Event(GLOBAL_SEARCH_OPEN_EVENT));
  };

  const showScrollToTop =
    activeTab === "archive" || activeTab === "list" || activeTab === "calendar";

  const activeAccountId = accounts.find((a) => a.is_active)?.id;

  useEffect(() => {
    api
      .getUserProfile()
      .then((profile) => setUsername(profile.data.name))
      .catch(() => setUsername(t("user.profile")));
  }, [t, activeAccountId]);

  useEffect(() => {
    api.getPlatform().then((p) => setIsMobile(p === "mobile")).catch(() => {});
  }, []);

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="main-header__brand">
          <div
            className="main-header__logo-wrap"
            onTouchStart={() => {
              if (!isMobile) return;
              logoPressTimer.current = setTimeout(openSearch, 600);
            }}
            onTouchEnd={() => {
              if (logoPressTimer.current) {
                clearTimeout(logoPressTimer.current);
                logoPressTimer.current = null;
              }
            }}
            onContextMenu={(e) => {
              if (isMobile) {
                e.preventDefault();
                openSearch();
              }
            }}
          >
            <OtakuDeckLogo className="main-header__logo" title={t("app.name")} />
          </div>
          <h1 className="main-header__title">{t("app.name")}</h1>
        </div>
        <PillNav activeTab={activeTab} onTabChange={onTabChange} />
        <div className="main-header__actions">
          <RefreshButton />
          {isMobile && (
            <button
              type="button"
              className="main-header__search pill-button pill-button--secondary"
              aria-label={t("common.searchAnime")}
              onClick={openSearch}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M10.5 3a7.5 7.5 0 015.96 12.17l4.27 4.27-1.41 1.41-4.27-4.27A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
          <UserMenu
            username={username}
            accounts={accounts}
            accountsLoading={accountsLoading}
            accountBusyId={accountBusyId}
            onProfile={() => setShowProfile(true)}
            onSettings={() => setShowSettings(true)}
            onLogout={logout}
            onSwitchAccount={switchAccount}
            onAddAccount={addAccount}
            onRemoveAccount={removeAccount}
            onSignInAccount={(id) => login({ accountId: id })}
          />
        </div>
      </header>
      <PullToRefresh
        enabled={isMobile}
        containerRef={mainRef}
        refreshing={isRefreshing}
        onRefresh={triggerRefresh}
      >
        <main ref={mainRef} className="main-content">
          {children}
        </main>
      </PullToRefresh>
      {showScrollToTop && <ScrollToTop containerRef={mainRef} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showProfile && (
        <ProfilePage
          onClose={() => setShowProfile(false)}
          onSaved={(name) => setUsername(name)}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import "@/styles/components/layout.css";
import "@/styles/components/nav.css";
import { OtakuDeckLogo } from "@/components/OtakuDeckLogo";
import { PillNav } from "@/components/PillNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UserMenu } from "@/components/UserMenu";
import { useRefresh } from "@/context/RefreshContext";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ProfilePage } from "@/pages/ProfilePage";
import type { NavTab } from "@/types/mal";

interface MainLayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function MainLayout({ activeTab, onTabChange, children }: MainLayoutProps) {
  const { logout } = useAuth();
  const { t } = useSettings();
  const { triggerRefresh } = useRefresh();
  const [username, setUsername] = useState(t("user.profile"));
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const showScrollToTop =
    activeTab === "archive" || activeTab === "list" || activeTab === "calendar";

  useEffect(() => {
    api
      .getUserProfile()
      .then((profile) => setUsername(profile.data.name))
      .catch(() => setUsername(t("user.profile")));
  }, [t]);

  useEffect(() => {
    api.getPlatform().then((p) => setIsMobile(p === "mobile")).catch(() => {});
  }, []);

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="main-header__brand">
          <OtakuDeckLogo className="main-header__logo" title={t("app.name")} />
          <h1 className="main-header__title">{t("app.name")}</h1>
        </div>
        <PillNav activeTab={activeTab} onTabChange={onTabChange} />
        <UserMenu
          username={username}
          onProfile={() => setShowProfile(true)}
          onSettings={() => setShowSettings(true)}
          onLogout={logout}
        />
      </header>
      <PullToRefresh
        enabled={isMobile}
        containerRef={mainRef}
        onRefresh={async () => {
          triggerRefresh();
          await new Promise((r) => setTimeout(r, 400));
        }}
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

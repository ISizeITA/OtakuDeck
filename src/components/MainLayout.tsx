import { useEffect, useState } from "react";
import "@/styles/components/layout.css";
import "@/styles/components/nav.css";
import { PillNav } from "@/components/PillNav";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UserMenu } from "@/components/UserMenu";
import { useTranslation } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { NavTab } from "@/types/mal";

interface MainLayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function MainLayout({ activeTab, onTabChange, children }: MainLayoutProps) {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState(t("user.profile"));
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    api
      .getUserProfile()
      .then((profile) => setUsername(profile.name))
      .catch(() => setUsername(t("user.profile")));
  }, [t]);

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="main-header__brand">
          <span className="main-header__logo" aria-hidden="true" />
          <h1 className="main-header__title">{t("app.name")}</h1>
        </div>
        <PillNav activeTab={activeTab} onTabChange={onTabChange} />
        <UserMenu
          username={username}
          onSettings={() => setShowSettings(true)}
          onLogout={logout}
        />
      </header>
      <main className="main-content">{children}</main>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

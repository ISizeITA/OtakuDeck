import { useState } from "react";
import { AnimeModalProvider } from "@/context/AnimeModalContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { LandingPage } from "@/pages/LandingPage";
import { HomePage } from "@/pages/HomePage";
import { ArchivePage } from "@/pages/ArchivePage";
import { ListPage } from "@/pages/ListPage";
import type { NavTab } from "@/types/mal";

function AppShell() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");

  return (
    <AnimeModalProvider>
      <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "home" && <HomePage />}
        {activeTab === "archive" && <ArchivePage />}
        {activeTab === "list" && <ListPage />}
      </MainLayout>
    </AnimeModalProvider>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <SettingsProvider>
      {isLoading ? (
        <div className="page page--centered">
          <span className="pill-button__spinner page__spinner" />
        </div>
      ) : !isAuthenticated ? (
        <LandingPage />
      ) : (
        <AppShell />
      )}
    </SettingsProvider>
  );
}
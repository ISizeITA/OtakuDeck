import { useState } from "react";
import { AnimeModalProvider, useAnimeModal } from "@/context/AnimeModalContext";
import { RefreshProvider } from "@/context/RefreshContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UpdateProvider } from "@/context/UpdateContext";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MainLayout } from "@/components/MainLayout";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useDeepLinkCapture } from "@/hooks/useDeepLinkCapture";
import { usePendingAnimeOpener } from "@/hooks/usePendingAnimeOpener";
import { usePendingNavOpener } from "@/hooks/usePendingNavOpener";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { isOnboardingComplete } from "@/lib/settingsStorage";
import { LandingPage } from "@/pages/LandingPage";
import { HomePage } from "@/pages/HomePage";
import { ArchivePage } from "@/pages/ArchivePage";
import { ListPage } from "@/pages/ListPage";
import { CalendarPage } from "@/pages/CalendarPage";
import type { NavTab } from "@/types/mal";

function AppShellContent() {
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete());
  const { openAnime, isOpen, closeAnime } = useAnimeModal();

  usePendingAnimeOpener(openAnime);
  usePendingNavOpener(setActiveTab);
  useKeyboardNav({ onTabChange: setActiveTab, modalOpen: isOpen, onCloseModal: closeAnime });

  return (
    <>
      <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "home" && <HomePage />}
        {activeTab === "archive" && <ArchivePage />}
        {activeTab === "list" && <ListPage />}
        {activeTab === "calendar" && <CalendarPage />}
      </MainLayout>
      <GlobalSearch />
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}

function AppShell() {
  return (
    <UpdateProvider>
      <RefreshProvider>
        <AnimeModalProvider>
          <AppShellContent />
        </AnimeModalProvider>
      </RefreshProvider>
      <UpdateBanner />
    </UpdateProvider>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  useDeepLinkCapture();

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

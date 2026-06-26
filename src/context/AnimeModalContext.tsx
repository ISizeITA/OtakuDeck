import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { recordRecentAnime } from "@/lib/recentAnime";
import { AnimeModal } from "@/components/AnimeModal";
import type { AnimeNode } from "@/types/mal";

interface AnimeModalContextValue {
  openAnime: (anime: AnimeNode | number) => void;
  closeAnime: () => void;
  isOpen: boolean;
  refreshKey: number;
  triggerRefresh: () => void;
}

const AnimeModalContext = createContext<AnimeModalContextValue | null>(null);

export function AnimeModalProvider({ children }: { children: ReactNode }) {
  const [animeId, setAnimeId] = useState<number | null>(null);
  const [preview, setPreview] = useState<AnimeNode | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const openAnime = useCallback((anime: AnimeNode | number) => {
    if (typeof anime === "number") {
      setPreview(null);
      setAnimeId(anime);
    } else {
      recordRecentAnime(anime);
      setPreview(anime);
      setAnimeId(anime.id);
    }
  }, []);

  const closeAnime = useCallback(() => {
    setAnimeId(null);
    setPreview(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <AnimeModalContext.Provider
      value={{ openAnime, closeAnime, isOpen: animeId !== null, refreshKey, triggerRefresh }}
    >
      {children}
      {animeId !== null && (
        <AnimeModal
          animeId={animeId}
          preview={preview}
          onClose={closeAnime}
          onSaved={triggerRefresh}
        />
      )}
    </AnimeModalContext.Provider>
  );
}

export function useAnimeModal() {
  const ctx = useContext(AnimeModalContext);
  if (!ctx) throw new Error("useAnimeModal must be used within AnimeModalProvider");
  return ctx;
}

import { useEffect } from "react";
import {
  PENDING_ANIME_EVENT,
  takePendingAnimeId,
} from "@/lib/pendingDeepLink";

export function usePendingAnimeOpener(onAnimeId: (id: number) => void) {
  useEffect(() => {
    function consume() {
      const id = takePendingAnimeId();
      if (id !== null) onAnimeId(id);
    }

    consume();

    function onPending() {
      consume();
    }

    window.addEventListener(PENDING_ANIME_EVENT, onPending);
    return () => window.removeEventListener(PENDING_ANIME_EVENT, onPending);
  }, [onAnimeId]);
}

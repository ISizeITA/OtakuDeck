import { useEffect } from "react";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { parseAnimeDeepLink } from "@/lib/deepLink";
import { enqueuePendingAnimeId } from "@/lib/pendingDeepLink";

/** Captures anime deep links at app root (works before login). */
export function useDeepLinkCapture() {
  useEffect(() => {
    function handleUrl(url: string) {
      const animeId = parseAnimeDeepLink(url);
      if (animeId !== null) {
        enqueuePendingAnimeId(animeId);
      }
    }

    async function init() {
      try {
        const startUrls = await getCurrent();
        if (startUrls) {
          for (const url of startUrls) {
            handleUrl(url);
          }
        }

        await onOpenUrl((urls) => {
          urls.forEach(handleUrl);
        });
      } catch {
        // Deep-link plugin unavailable outside Tauri runtime
      }
    }

    void init();
  }, []);
}

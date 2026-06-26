import { useEffect } from "react";
import {
  navTabFromDeepLink,
  PENDING_NAV_EVENT,
  takePendingNav,
} from "@/lib/pendingDeepLink";
import type { NavTab } from "@/types/mal";

export function usePendingNavOpener(onNavTab: (tab: NavTab) => void) {
  useEffect(() => {
    function consume() {
      const tab = takePendingNav();
      if (tab !== null) onNavTab(navTabFromDeepLink(tab));
    }

    consume();

    function onPending() {
      consume();
    }

    window.addEventListener(PENDING_NAV_EVENT, onPending);
    return () => window.removeEventListener(PENDING_NAV_EVENT, onPending);
  }, [onNavTab]);
}

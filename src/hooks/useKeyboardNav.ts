import { useEffect } from "react";
import type { NavTab } from "@/types/mal";

const TAB_ORDER: NavTab[] = ["home", "archive", "list", "calendar"];

interface UseKeyboardNavOptions {
  onTabChange: (tab: NavTab) => void;
  modalOpen: boolean;
  onCloseModal?: () => void;
}

export function useKeyboardNav({
  onTabChange,
  modalOpen,
  onCloseModal,
}: UseKeyboardNavOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Escape" && modalOpen) {
        event.preventDefault();
        onCloseModal?.();
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const index = Number.parseInt(event.key, 10);
      if (index >= 1 && index <= TAB_ORDER.length) {
        event.preventDefault();
        onTabChange(TAB_ORDER[index - 1]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, onCloseModal, onTabChange]);
}

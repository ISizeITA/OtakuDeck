import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/SettingsContext";
import "@/styles/components/user-menu.css";

interface UserMenuProps {
  username: string;
  onSettings: () => void;
  onLogout: () => void;
}

export function UserMenu({ username, onSettings, onLogout }: UserMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className={`user-menu__trigger pill-button pill-button--secondary ${open ? "user-menu__trigger--open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="user-menu__name">{username}</span>
        <svg
          className="user-menu__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <button
            type="button"
            className="user-menu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSettings();
            }}
          >
            {t("user.settings")}
          </button>
          <button
            type="button"
            className="user-menu__item user-menu__item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            {t("user.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

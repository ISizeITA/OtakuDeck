import { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import {
  formatSearchShortcutLabel,
  shortcutFromKeyboardEvent,
  type SearchShortcut,
} from "@/lib/keyboardShortcut";

interface ShortcutRecorderProps {
  value: SearchShortcut;
  onChange: (shortcut: SearchShortcut) => void;
  onReset: () => void;
}

export function ShortcutRecorder({ value, onChange, onReset }: ShortcutRecorderProps) {
  const { t } = useSettings();
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      const next = shortcutFromKeyboardEvent(e);
      if (next) {
        onChange(next);
        setRecording(false);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  return (
    <div className="shortcut-recorder">
      <kbd className="shortcut-recorder__value">
        {recording ? t("settings.shortcutRecording") : formatSearchShortcutLabel(value)}
      </kbd>
      <div className="shortcut-recorder__actions">
        <button
          type="button"
          className="shortcut-recorder__btn"
          onClick={() => setRecording(true)}
        >
          {t("settings.shortcutChange")}
        </button>
        <button type="button" className="shortcut-recorder__btn" onClick={onReset}>
          {t("settings.shortcutReset")}
        </button>
      </div>
    </div>
  );
}

export interface SearchShortcut {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

const SEARCH_SHORTCUT_KEY = "otakudeck-search-shortcut";

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function defaultSearchShortcut(): SearchShortcut {
  return isMacPlatform()
    ? { ctrl: false, meta: true, alt: false, shift: false, key: "k" }
    : { ctrl: true, meta: false, alt: false, shift: false, key: "k" };
}

function normalizeShortcut(raw: Partial<SearchShortcut>): SearchShortcut | null {
  const key = typeof raw.key === "string" ? raw.key.toLowerCase() : "";
  if (!key || key.length !== 1) return null;
  if (!raw.ctrl && !raw.meta && !raw.alt) return null;

  return {
    ctrl: Boolean(raw.ctrl),
    meta: Boolean(raw.meta),
    alt: Boolean(raw.alt),
    shift: Boolean(raw.shift),
    key,
  };
}

export function loadStoredSearchShortcut(): SearchShortcut {
  try {
    const stored = localStorage.getItem(SEARCH_SHORTCUT_KEY);
    if (!stored) return defaultSearchShortcut();
    const parsed = normalizeShortcut(JSON.parse(stored) as Partial<SearchShortcut>);
    return parsed ?? defaultSearchShortcut();
  } catch {
    return defaultSearchShortcut();
  }
}

export function saveSearchShortcut(shortcut: SearchShortcut) {
  localStorage.setItem(SEARCH_SHORTCUT_KEY, JSON.stringify(shortcut));
}

export function formatSearchShortcutLabel(
  shortcut: SearchShortcut,
  mac = isMacPlatform(),
): string {
  const parts: string[] = [];
  if (mac) {
    if (shortcut.ctrl) parts.push("⌃");
    if (shortcut.alt) parts.push("⌥");
    if (shortcut.shift) parts.push("⇧");
    if (shortcut.meta) parts.push("⌘");
    parts.push(shortcut.key.toUpperCase());
    return parts.join("");
  }
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.meta) parts.push("Win");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join("+");
}

export function matchesSearchShortcut(
  event: KeyboardEvent,
  shortcut: SearchShortcut,
): boolean {
  if (event.ctrlKey !== shortcut.ctrl) return false;
  if (event.metaKey !== shortcut.meta) return false;
  if (event.altKey !== shortcut.alt) return false;
  if (event.shiftKey !== shortcut.shift) return false;
  return event.key.toLowerCase() === shortcut.key.toLowerCase();
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): SearchShortcut | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : "";
  if (!key) return null;
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null;

  return {
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key,
  };
}

export const GLOBAL_SEARCH_OPEN_EVENT = "otakudeck-open-global-search";

export function requestOpenGlobalSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_OPEN_EVENT));
}

import type { ListTabFilter } from "@/types/mal";

export type ListSort = "title" | "date_added" | "community_score";

export interface ListPrefs {
  activeTab: ListTabFilter;
  sort: ListSort;
  genreIds: string[];
}

const LIST_PREFS_KEY = "otakudeck-list-prefs";

const DEFAULT_PREFS: ListPrefs = {
  activeTab: "all",
  sort: "date_added",
  genreIds: [],
};

export function loadListPrefs(): ListPrefs {
  try {
    const raw = localStorage.getItem(LIST_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ListPrefs>;
    return {
      activeTab: parsed.activeTab ?? DEFAULT_PREFS.activeTab,
      sort: parsed.sort ?? DEFAULT_PREFS.sort,
      genreIds: Array.isArray(parsed.genreIds) ? parsed.genreIds : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveListPrefs(prefs: ListPrefs) {
  localStorage.setItem(LIST_PREFS_KEY, JSON.stringify(prefs));
}

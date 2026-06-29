export interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  download_url?: string | null;
  release_url?: string | null;
  changelog?: string[];
  error?: string | null;
}

export const UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/ISizeITA/OtakuDeck/main/updates/manifest.json";

export const UPDATE_BANNER_DURATION_MS = 10_000;

export interface UpdateInstallProgress {
  phase: "download" | "install";
  percent: number;
}

export const UPDATE_INSTALL_PROGRESS_EVENT = "update-install-progress";

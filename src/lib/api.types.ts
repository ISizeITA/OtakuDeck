export type TranslateProvider = "mymemory" | "deepl" | "google";

export interface TranslateConfig {
  provider: TranslateProvider;
  apiKey?: string | null;
  apiUrl?: string | null;
  mymemoryEmail?: string | null;
}

export interface MyMemoryQuota {
  charactersUsed: number;
  charactersLimit: number;
  charactersRemaining: number;
  percentUsed: number;
  percentRemaining: number;
  hasEmail: boolean;
}

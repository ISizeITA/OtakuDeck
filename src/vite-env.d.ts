/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAL_CLIENT_ID: string;
  readonly VITE_MAL_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

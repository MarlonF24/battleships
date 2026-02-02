/// <reference types="vite/client" />

// If you want to add custom env variables, extend ImportMetaEnv:
interface ImportMetaEnv {
  readonly VITE_BACKEND_ADDRESS?: string;
  readonly VITE_PLAYERID_BROWSER_STORAGE?: "SESSION" | "LOCAL";
  // add more env variables here...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
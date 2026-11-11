/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  /** Logins gerenciados pelo Lovable Cloud ligados no painel (ex.: "microsoft,apple"). */
  readonly VITE_MANAGED_OAUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

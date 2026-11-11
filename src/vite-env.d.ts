/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  /** Logins gerenciados pelo Lovable Cloud ligados no painel (ex.: "microsoft,apple"). */
  readonly VITE_MANAGED_OAUTH_PROVIDERS?: string;
  /** Domínio público do app, sem https:// (ex.: "levelupexams.com.br"). */
  readonly VITE_SITE_DOMAIN?: string;
  /** E-mail de suporte/privacidade exibido nas páginas legais. */
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

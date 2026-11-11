import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { Plugin } from "vite";

/**
 * Gera /asset-manifest.json com todos os arquivos do build. O service worker (public/sw.js)
 * usa a lista para deixar o app instalado abrindo rápido e sem quebrar telas carregadas
 * sob demanda (inclusive logo após uma nova publicação).
 */
function assetManifest(): Plugin {
  return {
    name: "levelup-asset-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith("assets/") && /\.(js|css|woff2?|png|svg|webp)$/.test(f))
        .map((f) => `/${f}`);
      this.emitFile({ type: "asset", fileName: "asset-manifest.json", source: JSON.stringify({ files }) });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), assetManifest(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          charts: ["recharts"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));

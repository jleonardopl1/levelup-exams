import { lazy, Suspense, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReferralCapture } from "@/components/ReferralCapture";
import { OAuthReturnHandler } from "@/components/OAuthReturnHandler";
import { useSubscriptionSync } from "@/hooks/useSubscription";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";

/**
 * Depois de uma nova publicação, os arquivos antigos das telas deixam de existir e o
 * import falha ("Failed to fetch dynamically imported module"). Recarrega a página uma
 * única vez para pegar a versão nova, em vez de deixar a tela branca.
 */
function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    const key = "levelup-chunk-reload";
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(key); } catch { /* sem storage */ }
      return mod;
    } catch (error) {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem(key) === "1"; sessionStorage.setItem(key, "1"); } catch { reloaded = true; }
      if (!reloaded) {
        window.location.reload();
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }
  });
}

// Lazy-loaded pages for code splitting
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Quiz = lazyWithRetry(() => import("./pages/Quiz"));
const Result = lazyWithRetry(() => import("./pages/Result"));
const Ranking = lazyWithRetry(() => import("./pages/Ranking"));
const Upgrade = lazyWithRetry(() => import("./pages/Upgrade"));
const Mentor = lazyWithRetry(() => import("./pages/Mentor"));
const FAQ = lazyWithRetry(() => import("./pages/FAQ"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Rewards = lazyWithRetry(() => import("./pages/Rewards"));
const Achievements = lazyWithRetry(() => import("./pages/Achievements"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Affiliate = lazyWithRetry(() => import("./pages/Affiliate"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const Trilhas = lazyWithRetry(() => import("./pages/Trilhas"));
const Trilha = lazyWithRetry(() => import("./pages/Trilha"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const InstallApp = lazyWithRetry(() => import("./pages/InstallApp"));

/** Mantém o plano (Free/Plus) sincronizado com o Stripe a cada login. */
const SubscriptionSync = () => {
  useSubscriptionSync();
  return null;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ReferralCapture />
          <OAuthReturnHandler />
          <SubscriptionSync />
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/result" element={<Result />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/upgrade" element={<Upgrade />} />
              <Route path="/mentor" element={<Mentor />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/affiliate" element={<Affiliate />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route path="/trilhas" element={<Trilhas />} />
              <Route path="/trilhas/:slug" element={<Trilha />} />
              <Route path="/instalar" element={<InstallApp />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

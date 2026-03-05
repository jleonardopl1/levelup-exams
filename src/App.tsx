import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";

// Lazy-loaded pages for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Result = lazy(() => import("./pages/Result"));
const Ranking = lazy(() => import("./pages/Ranking"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Mentor = lazy(() => import("./pages/Mentor"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Admin = lazy(() => import("./pages/Admin"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

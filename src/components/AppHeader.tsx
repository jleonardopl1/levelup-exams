import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Share2, 
  Trophy, 
  Gift, 
  Settings, 
  LogOut,
  Crown,
  Sparkles,
  Home,
  BookOpen,
  Bot,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { PremiumBadge } from '@/components/PremiumBadge';
import { ShareModal } from '@/components/ShareModal';

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { isPremium, tier } = useQuestionLimits();
  const navigate = useNavigate();
  const location = useLocation();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/quiz', icon: BookOpen, label: 'Quiz' },
    { path: '/ranking', icon: Trophy, label: 'Ranking' },
    { path: '/rewards', icon: Gift, label: 'Recompensas' },
    { path: '/mentor', icon: Bot, label: 'Mentor IA' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <span className="text-lg">🎯</span>
            </div>
            <span className="font-display font-bold text-lg hidden sm:block">StudyQuiz</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Upgrade Button for Free Users */}
            {!isPremium && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/upgrade')}
                className="hidden sm:flex gap-1 border-accent/50 text-accent hover:bg-accent/10"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade
              </Button>
            )}

            {/* Dashboard Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="relative"
            >
              <LayoutDashboard className="w-5 h-5" />
            </Button>

            {/* Share Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareModalOpen(true)}
              className="hidden sm:flex"
            >
              <Share2 className="w-5 h-5" />
            </Button>

            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-semibold">
                      {getInitials(profile?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  {isPremium && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center shadow-md">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(profile?.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile?.display_name || 'Usuário'}</p>
                    <div className="flex items-center gap-1">
                      <PremiumBadge tier={tier} />
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/rewards')}>
                  <Gift className="mr-2 h-4 w-4" />
                  Recompensas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShareModalOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/faq')}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  FAQ
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isPremium && (
                  <DropdownMenuItem onClick={() => navigate('/upgrade')} className="text-accent">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Fazer Upgrade
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur animate-slide-up">
            <nav className="container px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-4 py-3"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShareModalOpen(true);
                  }}
                >
                  <Share2 className="w-5 h-5" />
                  Compartilhar Evolução
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} />
    </>
  );
}

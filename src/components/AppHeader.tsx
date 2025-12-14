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
  LogOut,
  Crown,
  Sparkles,
  Home,
  BookOpen,
  Bot,
  HelpCircle,
  Menu,
  X,
  TrendingUp,
  ChevronRight,
  Award
} from 'lucide-react';
import { PremiumBadge } from '@/components/PremiumBadge';
import { ShareModal } from '@/components/ShareModal';
import { NotificationCenter } from '@/components/NotificationCenter';
import Logo from '@/components/Logo';
import { StreakReminderToggle } from '@/components/StreakReminderToggle';

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
    { path: '/achievements', icon: Award, label: 'Conquistas' },
    { path: '/mentor', icon: Bot, label: 'Mentor IA' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 md:h-16 items-center justify-between px-3 md:px-4 gap-2">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center shrink-0">
            <Logo size="sm" showText={true} />
          </Link>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center max-w-2xl">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Dashboard Button - More prominent */}
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="hidden sm:flex gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all group"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Meu Progresso</span>
              <ChevronRight className="w-3 h-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </Button>

            {/* Mobile Dashboard Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="sm:hidden h-9 w-9 border-primary/30 text-primary hover:bg-primary/10"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>

            {/* Upgrade Button for Free Users */}
            {!isPremium && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/upgrade')}
                className="hidden md:flex gap-1.5 border-accent/50 text-accent hover:bg-accent/10 hover:border-accent"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">Upgrade</span>
              </Button>
            )}

            {/* Streak Reminder Toggle */}
            <div className="hidden sm:block">
              <StreakReminderToggle />
            </div>

            {/* Notification Center */}
            <NotificationCenter />

            {/* Share Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareModalOpen(true)}
              className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="w-4 h-4" />
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
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border/40 bg-background/95 backdrop-blur animate-fade-in">
            <nav className="container px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile Dashboard Link */}
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive('/dashboard')
                    ? 'bg-primary/10 text-primary'
                    : 'text-primary hover:bg-primary/10'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                Meu Progresso
              </Link>

              <div className="pt-2 border-t border-border/40 mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-4 py-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShareModalOpen(true);
                  }}
                >
                  <Share2 className="w-5 h-5" />
                  Compartilhar Evolução
                </Button>
                
                {!isPremium && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 px-4 py-2.5 text-accent"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/upgrade');
                    }}
                  >
                    <Sparkles className="w-5 h-5" />
                    Fazer Upgrade
                  </Button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} />
    </>
  );
}

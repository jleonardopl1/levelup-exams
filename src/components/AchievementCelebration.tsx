import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Confetti } from '@/components/Confetti';
import { Achievement } from '@/hooks/useRewards';
import { AchievementShareModal } from '@/components/AchievementShareModal';
import { Trophy, Star, Sparkles, X, Share2 } from 'lucide-react';

interface AchievementCelebrationProps {
  achievement: Achievement | null;
  open: boolean;
  onClose: () => void;
}

// Icon mapping
const iconMap: Record<string, string> = {
  star: '⭐',
  trophy: '🏆',
  medal: '🥇',
  fire: '🔥',
  flame: '🔥',
  zap: '⚡',
  target: '🎯',
  book: '📚',
  crown: '👑',
  rocket: '🚀',
  gem: '💎',
  heart: '❤️',
  lightning: '⚡',
  award: '🏅',
  gift: '🎁',
  sparkles: '✨',
  secret: '🔮',
};

// Tier colors
const tierColors: Record<string, string> = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-slate-300 to-slate-500',
  gold: 'from-yellow-400 to-amber-600',
  platinum: 'from-cyan-300 to-blue-500',
  diamond: 'from-purple-400 to-pink-600',
};

const tierGlow: Record<string, string> = {
  bronze: 'shadow-amber-500/50',
  silver: 'shadow-slate-400/50',
  gold: 'shadow-yellow-400/50',
  platinum: 'shadow-cyan-400/50',
  diamond: 'shadow-purple-500/50',
};

export function AchievementCelebration({ achievement, open, onClose }: AchievementCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open && achievement) {
      setShowConfetti(true);
      setIsAnimating(true);
      
      // Play celebration sound
      playSound();
      
      // Reset animation states
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
      
      // Stop confetti after a while
      setTimeout(() => {
        setShowConfetti(false);
      }, 4000);
    }
  }, [open, achievement]);

  const playSound = () => {
    try {
      // Create audio context for celebration sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Play a series of notes for celebration
      const playNote = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      
      // Celebration melody
      playNote(523.25, now, 0.15); // C5
      playNote(659.25, now + 0.1, 0.15); // E5
      playNote(783.99, now + 0.2, 0.15); // G5
      playNote(1046.50, now + 0.3, 0.3); // C6
      
    } catch (error) {
      console.log('Audio not available');
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  if (!achievement) return null;

  const tierColor = tierColors[achievement.tier] || tierColors.bronze;
  const tierShadow = tierGlow[achievement.tier] || tierGlow.bronze;

  return (
    <>
      {showConfetti && <Confetti isActive={showConfetti} />}
      
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md border-0 bg-transparent shadow-none p-0 overflow-visible">
          <div 
            className={`relative bg-gradient-to-br from-card via-card to-card/95 rounded-3xl p-6 shadow-2xl border border-border/50 ${
              isAnimating ? 'animate-scale-in' : ''
            }`}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Decorative elements */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${tierColor} shadow-xl ${tierShadow} flex items-center justify-center animate-bounce`}>
                <span className="text-4xl">{iconMap[achievement.icon] || '🏆'}</span>
              </div>
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
            </div>

            {/* Sparkles */}
            <div className="absolute -top-4 -left-4 text-2xl animate-pulse">✨</div>
            <div className="absolute -top-2 -right-6 text-xl animate-pulse" style={{ animationDelay: '0.2s' }}>⭐</div>
            <div className="absolute top-8 -right-4 text-lg animate-pulse" style={{ animationDelay: '0.4s' }}>✨</div>

            {/* Content */}
            <div className="pt-12 text-center">
              <div className="mb-2">
                <Sparkles className="w-5 h-5 mx-auto text-accent animate-spin-slow" />
              </div>
              
              <h2 className="text-lg font-medium text-accent mb-1">Nova Conquista!</h2>
              
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">
                {achievement.name}
              </h3>
              
              <p className="text-muted-foreground mb-4">
                {achievement.description}
              </p>

              {/* Points reward */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-accent/20 to-primary/20 mb-6">
                <Star className="w-5 h-5 text-accent fill-accent" />
                <span className="font-bold text-lg text-foreground">+{achievement.points_reward}</span>
                <span className="text-muted-foreground">pontos</span>
              </div>

              {/* Tier badge */}
              <div className="flex justify-center gap-2 mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r ${tierColor} text-white shadow-md`}>
                  {achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="flex-1 gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    onClose();
                    window.location.href = '/achievements';
                  }}
                  className="flex-1 bg-gradient-to-r from-accent to-primary hover:opacity-90"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Ver Todas
                </Button>
              </div>
            </div>

            {/* Bottom decoration */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-accent/40" />
              <div className="w-3 h-3 rounded-full bg-primary/50" />
              <div className="w-2 h-2 rounded-full bg-accent/40" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <AchievementShareModal 
        achievement={achievement}
        open={showShareModal}
        onOpenChange={setShowShareModal}
      />
    </>
  );
}

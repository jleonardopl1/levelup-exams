import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Star, Zap, BookOpen, Flame, Award, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confetti, CelebrationGlow } from '@/components/Confetti';
import { useUnshownMilestones, useMarkMilestoneShown, getMilestoneInfo, Milestone } from '@/hooks/useMilestones';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  star: Star,
  zap: Zap,
  trophy: Trophy,
  'book-open': BookOpen,
  flame: Flame,
  award: Award,
};

export function MilestoneModal() {
  const { data: unshownMilestones = [] } = useUnshownMilestones();
  const markShown = useMarkMilestoneShown();
  const [currentMilestone, setCurrentMilestone] = useState<Milestone | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Show the first unshown milestone
  useEffect(() => {
    if (unshownMilestones.length > 0 && !currentMilestone) {
      setCurrentMilestone(unshownMilestones[0]);
      setShowConfetti(true);
    }
  }, [unshownMilestones, currentMilestone]);

  const handleClose = async () => {
    if (!currentMilestone) return;
    
    setIsClosing(true);
    await markShown.mutateAsync(currentMilestone.id);
    
    setTimeout(() => {
      setCurrentMilestone(null);
      setIsClosing(false);
      setShowConfetti(false);
    }, 300);
  };

  if (!currentMilestone) return null;

  const info = getMilestoneInfo(currentMilestone.milestone_type, currentMilestone.milestone_value);
  const Icon = iconMap[info.icon] || Award;

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] transition-opacity duration-300",
          isClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div 
        className={cn(
          "fixed inset-0 z-[101] flex items-center justify-center p-4 transition-all duration-300",
          isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
      >
        <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
          {/* Gradient background */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-20",
            info.color
          )} />
          
          {/* Animated rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
            <div className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-r animate-pulse-ring opacity-30",
              info.color
            )} />
            <div className={cn(
              "absolute inset-4 rounded-full bg-gradient-to-r animate-pulse-ring opacity-20",
              info.color
            )} style={{ animationDelay: '0.3s' }} />
            <div className={cn(
              "absolute inset-8 rounded-full bg-gradient-to-r animate-pulse-ring opacity-10",
              info.color
            )} style={{ animationDelay: '0.6s' }} />
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-background/50 hover:bg-background/80 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="relative p-8 text-center">
            {/* Icon */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className={cn(
                "absolute inset-0 rounded-full bg-gradient-to-br animate-bounce-in",
                info.color
              )}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="w-12 h-12 text-white drop-shadow-lg" />
                </div>
              </div>
              
              {/* Sparkles */}
              <Star className="absolute -top-2 -left-2 w-6 h-6 text-accent animate-sparkle" style={{ animationDelay: '0s' }} />
              <Star className="absolute -top-1 -right-3 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.2s' }} />
              <Star className="absolute -bottom-1 -left-3 w-4 h-4 text-accent animate-sparkle" style={{ animationDelay: '0.4s' }} />
              <Star className="absolute -bottom-2 right-0 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.6s' }} />
            </div>

            {/* Text */}
            <div className="space-y-3 mb-8">
              <p className="text-sm font-medium text-primary uppercase tracking-wider">
                🎉 Marco Alcançado!
              </p>
              <h2 className="text-3xl font-display font-bold animate-scale-up">
                {info.title}
              </h2>
              <p className="text-muted-foreground">
                {info.description}
              </p>
            </div>

            {/* Action */}
            <Button
              variant="hero"
              size="xl"
              className="w-full animate-fade-in"
              onClick={handleClose}
              style={{ animationDelay: '0.3s' }}
            >
              Continuar 🚀
            </Button>
          </div>
        </div>
      </div>

      {/* Celebration effects */}
      <Confetti isActive={showConfetti} duration={4000} />
      <CelebrationGlow isActive={showConfetti} />
    </>,
    document.body
  );
}

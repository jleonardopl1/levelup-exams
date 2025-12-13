import { Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumBadgeProps {
  tier: string;
  className?: string;
  showLabel?: boolean;
}

export function PremiumBadge({ tier, className, showLabel = true }: PremiumBadgeProps) {
  if (tier !== 'plus') return null;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
      "bg-gradient-to-r from-amber-500 to-yellow-400",
      "text-white text-xs font-bold shadow-lg shadow-amber-500/25",
      className
    )}>
      <Crown className="w-3.5 h-3.5" />
      {showLabel && <span>PLUS</span>}
    </div>
  );
}

interface UpgradePromptProps {
  questionsRemaining: number;
  dailyLimit: number;
  className?: string;
}

export function UsageMeter({ questionsRemaining, dailyLimit, className }: UpgradePromptProps) {
  const percentage = Math.round((questionsRemaining / dailyLimit) * 100);
  const isLow = questionsRemaining <= 10;
  const isEmpty = questionsRemaining === 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Questões restantes hoje</span>
        <span className={cn(
          "font-bold",
          isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-foreground"
        )}>
          {questionsRemaining}/{dailyLimit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isEmpty ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface UpgradeCardProps {
  onUpgrade?: () => void;
}

export function UpgradeCard({ onUpgrade }: UpgradeCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary via-primary to-accent">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-6 h-6 text-amber-300" />
          <span className="text-lg font-display font-bold text-white">Upgrade para Plus</span>
        </div>
        
        <ul className="space-y-2 mb-4 text-sm text-white/90">
          <li className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-300" />
            Questões ilimitadas
          </li>
          <li className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-300" />
            Explicações em PDF
          </li>
          <li className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-300" />
            Estatísticas avançadas
          </li>
          <li className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-300" />
            Questões exclusivas
          </li>
        </ul>
        
        <button
          onClick={onUpgrade}
          className="w-full py-3 rounded-xl bg-white text-primary font-bold text-sm hover:bg-white/90 transition-colors"
        >
          Assinar Agora
        </button>
      </div>
    </div>
  );
}

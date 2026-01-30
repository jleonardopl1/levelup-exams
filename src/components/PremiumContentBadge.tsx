import { Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumContentBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'glow';
}

export function PremiumContentBadge({ 
  className, 
  size = 'sm',
  variant = 'default' 
}: PremiumContentBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  if (variant === 'minimal') {
    return (
      <div className={cn(
        "inline-flex items-center justify-center",
        "w-5 h-5 rounded-full",
        "bg-gradient-to-br from-amber-400 to-amber-600",
        "shadow-sm shadow-amber-500/30",
        className
      )}>
        <Crown className="w-3 h-3 text-white" />
      </div>
    );
  }

  if (variant === 'glow') {
    return (
      <div className={cn(
        "inline-flex items-center rounded-full",
        "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500",
        "text-white font-bold uppercase tracking-wide",
        "shadow-lg shadow-amber-500/40",
        "animate-pulse",
        sizeClasses[size],
        className
      )}>
        <Sparkles className={iconSizes[size]} />
        <span>Plus</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center rounded-full",
      "bg-gradient-to-r from-amber-500 to-yellow-400",
      "text-white font-bold uppercase tracking-wide",
      "shadow-md shadow-amber-500/25",
      sizeClasses[size],
      className
    )}>
      <Crown className={iconSizes[size]} />
      <span>Plus</span>
    </div>
  );
}

import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  animated?: boolean;
}

export default function Logo({ 
  className, 
  size = 'md', 
  showText = true,
  animated = true 
}: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon */}
      <div className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
        animated && 'group'
      )}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn(
            'w-full h-full',
            animated && 'transition-transform duration-300 group-hover:scale-110'
          )}
        >
          {/* Background gradient circle */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="hsl(280, 80%, 60%)" />
            </linearGradient>
            <linearGradient id="arrowGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary-foreground))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--primary-foreground))" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Main hexagon/badge shape */}
          <path
            d="M32 4L56 18V46L32 60L8 46V18L32 4Z"
            fill="url(#logoGradient)"
            className={cn(animated && 'drop-shadow-lg')}
          />
          
          {/* Inner highlight */}
          <path
            d="M32 8L52 20V44L32 56L12 44V20L32 8Z"
            fill="none"
            stroke="hsl(var(--primary-foreground))"
            strokeOpacity="0.2"
            strokeWidth="1"
          />
          
          {/* Level up arrow */}
          <g filter={animated ? "url(#glow)" : undefined}>
            <path
              d="M32 16L44 32H36V48H28V32H20L32 16Z"
              fill="url(#arrowGradient)"
              className={cn(
                animated && 'animate-bounce-slow origin-center'
              )}
              style={{
                animationDuration: '2s',
                animationIterationCount: 'infinite',
              }}
            />
          </g>
          
          {/* Stars/sparkles for gamification */}
          <circle cx="18" cy="24" r="2" fill="hsl(var(--primary-foreground))" opacity="0.8" />
          <circle cx="46" cy="24" r="2" fill="hsl(var(--primary-foreground))" opacity="0.8" />
          <circle cx="32" cy="52" r="1.5" fill="hsl(var(--primary-foreground))" opacity="0.6" />
        </svg>
        
        {/* Animated glow effect */}
        {animated && (
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn(
            'font-display font-bold tracking-tight',
            textSizeClasses[size],
            'bg-gradient-to-r from-primary via-primary to-purple-500 bg-clip-text text-transparent'
          )}>
            LevelUp
          </span>
          <span className={cn(
            'font-display font-semibold tracking-widest uppercase',
            size === 'sm' ? 'text-[0.6rem]' : size === 'md' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-base',
            'text-muted-foreground'
          )}>
            Exams
          </span>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useRecentAchievements, getAchievementIcon, getTierColor, getTierBadge } from '@/hooks/useRecentAchievements';
import { Award, ChevronRight, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function RecentAchievementsCard() {
  const { data: achievements, isLoading } = useRecentAchievements(3);

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-card/50 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="space-y-2">
          <div className="h-12 bg-muted rounded-xl" />
          <div className="h-12 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!achievements || achievements.length === 0) {
    return (
      <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 shadow-md">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
            <Award className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-0.5">Conquistas</h3>
            <p className="text-sm text-muted-foreground">
              Complete simulados para desbloquear conquistas!
            </p>
          </div>
          <Link 
            to="/rewards" 
            className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-primary" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border/50 shadow-md">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/15 to-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/10 to-accent/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
      
      {/* Header */}
      <div className="relative px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-base">Conquistas Recentes</h3>
        </div>
        <Link 
          to="/rewards" 
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          Ver todas
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      
      {/* Achievements list */}
      <div className="relative px-4 pb-4 space-y-2">
        {achievements.map((item, index) => (
          <div 
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${
              index === 0 ? 'from-accent/10 via-transparent to-transparent' : 'hover:bg-muted/30'
            } transition-all group`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Achievement icon */}
            <div className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${getTierColor(item.achievement.tier)} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
              <span className="text-xl">{getAchievementIcon(item.achievement.icon)}</span>
              <div className="absolute -top-1 -right-1 text-xs">
                {getTierBadge(item.achievement.tier)}
              </div>
            </div>
            
            {/* Achievement info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground truncate">
                  {item.achievement.name}
                </p>
                {index === 0 && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-accent/20 text-accent rounded-full">
                    Novo!
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {item.achievement.description}
              </p>
            </div>
            
            {/* Time ago */}
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.unlocked_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
              <p className="text-xs font-medium text-accent">
                +{item.achievement.points_reward} pts
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

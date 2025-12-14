import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RecentAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement: {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    tier: string;
    points_reward: number;
  };
}

export function useRecentAchievements(limit: number = 3) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-achievements', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          id,
          achievement_id,
          unlocked_at,
          achievement:achievements(
            id,
            code,
            name,
            description,
            icon,
            tier,
            points_reward
          )
        `)
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as RecentAchievement[];
    },
    enabled: !!user,
  });
}

// Get achievement icon based on the icon field
export function getAchievementIcon(icon: string): string {
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
  };
  return iconMap[icon] || '🏆';
}

// Get tier color
export function getTierColor(tier: string): string {
  const colorMap: Record<string, string> = {
    bronze: 'from-amber-700 to-amber-600',
    silver: 'from-slate-400 to-slate-300',
    gold: 'from-yellow-500 to-amber-400',
    platinum: 'from-cyan-400 to-blue-400',
    diamond: 'from-purple-500 to-pink-400',
  };
  return colorMap[tier] || 'from-primary to-accent';
}

// Get tier badge
export function getTierBadge(tier: string): string {
  const badgeMap: Record<string, string> = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '💠',
    diamond: '💎',
  };
  return badgeMap[tier] || '🏅';
}

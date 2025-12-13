import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calculateLevel } from './useRewards';

interface QuizRewardResult {
  pointsEarned: number;
  newLevel: number | null;
  achievementsUnlocked: string[];
  shouldShowConfetti: boolean;
}

export function useProcessQuizRewards() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  const processRewards = useCallback(async ({
    correctAnswers,
    totalQuestions,
    timeSpentSeconds,
    consecutiveCorrect,
  }: {
    correctAnswers: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    consecutiveCorrect: number;
  }): Promise<QuizRewardResult> => {
    if (!user) return { pointsEarned: 0, newLevel: null, achievementsUnlocked: [], shouldShowConfetti: false };

    const result: QuizRewardResult = {
      pointsEarned: 0,
      newLevel: null,
      achievementsUnlocked: [],
      shouldShowConfetti: false,
    };

    try {
      // Get or create user rewards
      let { data: rewards } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!rewards) {
        const { data: newRewards } = await supabase
          .from('user_rewards')
          .insert({ user_id: user.id })
          .select()
          .single();
        rewards = newRewards;
      }

      if (!rewards) return result;

      // Calculate points earned
      const accuracy = correctAnswers / totalQuestions;
      const basePoints = correctAnswers * 10;
      const accuracyBonus = accuracy >= 0.8 ? 20 : accuracy >= 0.6 ? 10 : 0;
      const speedBonus = timeSpentSeconds < 300 ? 15 : timeSpentSeconds < 450 ? 5 : 0;
      const perfectBonus = accuracy === 1 ? 50 : 0;
      const streakBonus = consecutiveCorrect >= 5 ? consecutiveCorrect * 2 : 0;
      
      const totalPointsEarned = basePoints + accuracyBonus + speedBonus + perfectBonus + streakBonus;
      result.pointsEarned = totalPointsEarned;

      // Update consecutive correct tracking
      const newConsecutive = accuracy === 1 ? rewards.consecutive_correct + correctAnswers : 0;
      const newMaxConsecutive = Math.max(rewards.max_consecutive_correct, newConsecutive, consecutiveCorrect);

      // Calculate new level
      const newTotalPoints = rewards.total_points + totalPointsEarned;
      const oldLevel = rewards.current_level;
      const newLevel = calculateLevel(newTotalPoints);

      // Update rewards
      await supabase
        .from('user_rewards')
        .update({
          total_points: newTotalPoints,
          current_level: newLevel,
          consecutive_correct: newConsecutive,
          max_consecutive_correct: newMaxConsecutive,
          total_time_seconds: rewards.total_time_seconds + timeSpentSeconds,
          last_session_date: new Date().toISOString().split('T')[0],
        })
        .eq('user_id', user.id);

      // Check for level up
      if (newLevel > oldLevel) {
        result.newLevel = newLevel;
        result.shouldShowConfetti = true;
        setShowConfetti(true);
        setShowGlow(true);
        
        // Create persistent notification for level up
        await supabase.from('notifications').insert([{
          user_id: user.id,
          type: 'level_up',
          title: `Subiu para o Nível ${newLevel}!`,
          message: 'Continue assim para desbloquear mais recompensas!',
          icon: 'zap',
          data: { level: newLevel, previous_level: oldLevel },
        }]);
        
        toast.success(`🎉 Subiu para o Nível ${newLevel}!`, {
          description: 'Continue assim para desbloquear mais recompensas!',
          duration: 5000,
        });
      }

      // Get user's profile for total stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_quizzes, total_correct, total_questions, streak_days')
        .eq('user_id', user.id)
        .single();

      // Get already unlocked achievements
      const { data: unlockedAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);

      const unlockedIds = new Set(unlockedAchievements?.map(a => a.achievement_id) || []);

      // Get all achievements to check
      const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*');

      if (allAchievements && profile) {
        const totalQuizzesCompleted = profile.total_quizzes + 1;
        const totalCorrectOverall = profile.total_correct + correctAnswers;
        const streakDays = profile.streak_days;

        for (const achievement of allAchievements) {
          if (unlockedIds.has(achievement.id)) continue;

          let shouldUnlock = false;

          switch (achievement.requirement_type) {
            case 'quizzes_completed':
              shouldUnlock = totalQuizzesCompleted >= achievement.requirement_value;
              break;
            case 'correct_answers':
              shouldUnlock = totalCorrectOverall >= achievement.requirement_value;
              break;
            case 'perfect_score':
              shouldUnlock = accuracy === 1 && totalQuestions >= achievement.requirement_value;
              break;
            case 'consecutive_correct':
              shouldUnlock = newMaxConsecutive >= achievement.requirement_value;
              break;
            case 'streak_days':
              shouldUnlock = streakDays >= achievement.requirement_value;
              break;
            case 'points_earned':
              shouldUnlock = newTotalPoints >= achievement.requirement_value;
              break;
            case 'level_reached':
              shouldUnlock = newLevel >= achievement.requirement_value;
              break;
            case 'time_spent':
              shouldUnlock = (rewards.total_time_seconds + timeSpentSeconds) >= achievement.requirement_value;
              break;
          }

          if (shouldUnlock) {
            const { error } = await supabase
              .from('user_achievements')
              .insert({
                user_id: user.id,
                achievement_id: achievement.id,
              });

            if (!error) {
              result.achievementsUnlocked.push(achievement.name);
              
              // Trigger celebration for rare achievements (gold/platinum)
              if (achievement.tier === 'gold' || achievement.tier === 'platinum') {
                result.shouldShowConfetti = true;
                setShowConfetti(true);
                setShowGlow(true);
              }
              
              // Add achievement points to total
              await supabase
                .from('user_rewards')
                .update({
                  total_points: newTotalPoints + achievement.points_reward,
                })
                .eq('user_id', user.id);

              // Create persistent notification for achievement
              await supabase.from('notifications').insert([{
                user_id: user.id,
                type: 'achievement',
                title: achievement.name,
                message: `${achievement.description} (+${achievement.points_reward} pts)`,
                icon: achievement.icon || 'trophy',
                data: { 
                  achievement_id: achievement.id, 
                  tier: achievement.tier,
                  points_reward: achievement.points_reward 
                },
              }]);

              // Show achievement notification
              toast.success(`🏆 ${achievement.name}`, {
                description: `${achievement.description} (+${achievement.points_reward} pts)`,
                duration: 5000,
              });
            }
          }
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['user-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });

      // Show points earned notification
      if (totalPointsEarned > 0) {
        setTimeout(() => {
          toast.info(`+${totalPointsEarned} pontos ganhos!`, {
            description: getPointsBreakdown(basePoints, accuracyBonus, speedBonus, perfectBonus, streakBonus),
            duration: 4000,
          });
        }, 500);
      }

      return result;
    } catch (error) {
      console.error('Error processing quiz rewards:', error);
      return result;
    }
  }, [user, queryClient]);

  return { processRewards, showConfetti, setShowConfetti, showGlow, setShowGlow };
}

function getPointsBreakdown(base: number, accuracy: number, speed: number, perfect: number, streak: number): string {
  const parts: string[] = [];
  parts.push(`${base} base`);
  if (accuracy > 0) parts.push(`+${accuracy} precisão`);
  if (speed > 0) parts.push(`+${speed} velocidade`);
  if (perfect > 0) parts.push(`+${perfect} perfeito`);
  if (streak > 0) parts.push(`+${streak} sequência`);
  return parts.join(' | ');
}

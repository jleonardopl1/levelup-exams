import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "./useProfile";

const DAILY_AI_LIMIT = 6;

export const useAIMentorUsage = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ai-mentor-usage", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("ai_mentor_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useAIMentorLimits = () => {
  const { data: usage, isLoading } = useAIMentorUsage();
  const { data: profile } = useProfile();

  const isPremium = profile?.tier === "plus";
  const questionsUsed = usage?.questions_used ?? 0;
  const dailyLimit = isPremium ? DAILY_AI_LIMIT : 0;
  const questionsRemaining = Math.max(0, dailyLimit - questionsUsed);
  const hasReachedLimit = !isPremium || questionsUsed >= dailyLimit;

  return {
    questionsUsed,
    dailyLimit,
    questionsRemaining,
    hasReachedLimit,
    isPremium,
    isLoading,
  };
};

export const useIncrementAIMentorUsage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const today = new Date().toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("ai_mentor_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("ai_mentor_usage")
          .update({ questions_used: existing.questions_used + 1 })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_mentor_usage")
          .insert({
            user_id: user.id,
            usage_date: today,
            questions_used: 1,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-mentor-usage"] });
    },
  });
};

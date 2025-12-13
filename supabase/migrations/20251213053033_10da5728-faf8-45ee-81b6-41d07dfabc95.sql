-- Create a secure RPC function for leaderboard that exposes only necessary data
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  period text DEFAULT 'all',
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  display_name text,
  score int,
  correct_answers int,
  total_questions int,
  user_id uuid,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  date_filter timestamptz;
BEGIN
  date_filter := CASE period
    WHEN 'today' THEN CURRENT_DATE::timestamptz
    WHEN 'week' THEN (CURRENT_DATE - INTERVAL '7 days')::timestamptz
    WHEN 'month' THEN (CURRENT_DATE - INTERVAL '30 days')::timestamptz
    ELSE '1970-01-01'::timestamptz
  END;
  
  RETURN QUERY
  SELECT 
    qr.id,
    COALESCE(p.display_name, 'Anônimo') as display_name,
    qr.score,
    qr.correct_answers,
    qr.total_questions,
    qr.user_id,
    qr.created_at
  FROM quiz_results qr
  LEFT JOIN profiles p ON qr.user_id = p.user_id
  WHERE qr.created_at >= date_filter
  ORDER BY qr.score DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon, authenticated;

-- Remove overly permissive public SELECT policies
DROP POLICY IF EXISTS "Anyone can view profiles for leaderboard" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view quiz results for leaderboard" ON public.quiz_results;
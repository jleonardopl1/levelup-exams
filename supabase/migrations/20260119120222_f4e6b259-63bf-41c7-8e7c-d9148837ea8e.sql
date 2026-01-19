-- Drop the existing validate_answer function
DROP FUNCTION IF EXISTS public.validate_answer(uuid, integer);

-- Create the new validate_answer function with rate limiting
CREATE OR REPLACE FUNCTION public.validate_answer(p_question_id uuid, p_selected_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_correct_index integer;
  v_explicacao text;
  v_is_correct boolean;
  v_user_id uuid;
  v_request_count integer;
  v_window_start timestamptz;
  v_rate_limit integer := 60; -- Max 60 validations per minute
  v_window_duration interval := interval '1 minute';
BEGIN
  -- Get the current user ID (can be null for anonymous)
  v_user_id := auth.uid();
  
  -- Rate limiting check
  SELECT request_count, window_start INTO v_request_count, v_window_start
  FROM public.rate_limits
  WHERE identifier = COALESCE(v_user_id::text, 'anonymous')
    AND endpoint = 'validate_answer'
    AND window_start > now() - v_window_duration;
  
  IF v_request_count IS NOT NULL AND v_request_count >= v_rate_limit THEN
    RETURN jsonb_build_object(
      'error', 'Rate limit exceeded. Please wait before trying again.',
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_window_start + v_window_duration - now()))::integer
    );
  END IF;
  
  -- Update or insert rate limit record
  INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (COALESCE(v_user_id::text, 'anonymous'), 'validate_answer', 1, now())
  ON CONFLICT (identifier, endpoint) 
  DO UPDATE SET 
    request_count = CASE 
      WHEN rate_limits.window_start > now() - v_window_duration 
      THEN rate_limits.request_count + 1 
      ELSE 1 
    END,
    window_start = CASE 
      WHEN rate_limits.window_start > now() - v_window_duration 
      THEN rate_limits.window_start 
      ELSE now() 
    END,
    updated_at = now();
  
  -- Get the correct answer from the questions table
  SELECT correta, explicacao INTO v_correct_index, v_explicacao
  FROM public.questions
  WHERE id = p_question_id;
  
  IF v_correct_index IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;
  
  v_is_correct := (p_selected_index = v_correct_index);
  
  RETURN jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_index', v_correct_index,
    'explicacao', v_explicacao
  );
END;
$function$;

-- Add unique constraint on rate_limits if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rate_limits_identifier_endpoint_key'
  ) THEN
    ALTER TABLE public.rate_limits 
    ADD CONSTRAINT rate_limits_identifier_endpoint_key 
    UNIQUE (identifier, endpoint);
  END IF;
END $$;
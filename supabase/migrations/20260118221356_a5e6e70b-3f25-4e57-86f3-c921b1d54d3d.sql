-- Create a public view that excludes the correct answer
CREATE OR REPLACE VIEW public.questions_public AS
SELECT 
  id,
  enunciado,
  alternativas,
  categoria,
  dificuldade,
  explicacao,
  created_at,
  subject_id
FROM public.questions;

-- Grant access to the view
GRANT SELECT ON public.questions_public TO anon, authenticated;

-- Create a secure function to validate answers server-side
CREATE OR REPLACE FUNCTION public.validate_answer(
  p_question_id uuid,
  p_selected_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_index integer;
  v_explicacao text;
  v_is_correct boolean;
BEGIN
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_answer(uuid, integer) TO authenticated;

-- Revoke direct SELECT on the questions table from regular users
-- Keep the current policy but we'll update the code to use the view instead
REVOKE SELECT ON public.questions FROM anon, authenticated;

-- Grant SELECT on the view instead
GRANT SELECT ON public.questions_public TO anon, authenticated;
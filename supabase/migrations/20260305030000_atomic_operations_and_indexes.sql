-- Atomic reward redemption RPC function
CREATE OR REPLACE FUNCTION redeem_reward(
  p_user_id UUID,
  p_reward_id UUID,
  p_points_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_points INTEGER;
  v_redemption_id UUID;
BEGIN
  -- Lock the user_rewards row to prevent concurrent modifications
  SELECT total_points INTO v_current_points
  FROM user_rewards
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User rewards not found');
  END IF;

  IF v_current_points < p_points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pontos insuficientes');
  END IF;

  -- Deduct points atomically
  UPDATE user_rewards
  SET total_points = total_points - p_points_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create redemption record
  INSERT INTO user_redemptions (user_id, reward_id, points_spent)
  VALUES (p_user_id, p_reward_id, p_points_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id);
END;
$$;

-- Atomic daily usage increment RPC function
CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_count INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO daily_question_usage (user_id, usage_date, questions_used)
  VALUES (p_user_id, p_date, p_count)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    questions_used = daily_question_usage.questions_used + p_count,
    updated_at = NOW()
  RETURNING questions_used INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- Atomic points increment RPC function (for achievements)
CREATE OR REPLACE FUNCTION increment_user_points(
  p_user_id UUID,
  p_points INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  UPDATE user_rewards
  SET total_points = total_points + p_points,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING total_points INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_answers_user_id ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_questions_categoria ON questions(categoria);
CREATE INDEX IF NOT EXISTS idx_daily_question_usage_user_date ON daily_question_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_mentor_usage_user_date ON ai_mentor_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint ON rate_limits(identifier, endpoint);

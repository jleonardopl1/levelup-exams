export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          points_reward: number
          requirement_type: string
          requirement_value: number
          tier: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          points_reward?: number
          requirement_type: string
          requirement_value: number
          tier?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          points_reward?: number
          requirement_type?: string
          requirement_value?: number
          tier?: string
        }
        Relationships: []
      }
      affiliate_payouts: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          referral_code_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          referral_code_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          referral_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lessons: {
        Row: {
          first_seen: string
          hits: number
          id: number
          is_active: boolean
          last_seen: string
          lesson: string
          lesson_hash: string
          source: string
          subject_id: string
        }
        Insert: {
          first_seen?: string
          hits?: number
          id?: never
          is_active?: boolean
          last_seen?: string
          lesson: string
          lesson_hash: string
          source: string
          subject_id: string
        }
        Update: {
          first_seen?: string
          hits?: number
          id?: never
          is_active?: boolean
          last_seen?: string
          lesson?: string
          lesson_hash?: string
          source?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_mentor_usage: {
        Row: {
          created_at: string
          id: string
          questions_used: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          agent: string
          attempts: number
          created_at: string
          error: string | null
          function_name: string
          id: number
          input_tokens: number | null
          latency_ms: number | null
          metadata: Json
          model: string | null
          output_tokens: number | null
          prompt_version: string | null
          status: string
          subject_id: string | null
        }
        Insert: {
          agent: string
          attempts?: number
          created_at?: string
          error?: string | null
          function_name: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          prompt_version?: string | null
          status: string
          subject_id?: string | null
        }
        Update: {
          agent?: string
          attempts?: number
          created_at?: string
          error?: string | null
          function_name?: string
          id?: never
          input_tokens?: number | null
          latency_ms?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          prompt_version?: string | null
          status?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          challenge_type: string
          code: string
          created_at: string
          description: string
          difficulty: string
          icon: string
          id: string
          is_active: boolean
          points_reward: number
          target_value: number
          title: string
        }
        Insert: {
          challenge_type: string
          code: string
          created_at?: string
          description: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          target_value: number
          title: string
        }
        Update: {
          challenge_type?: string
          code?: string
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          points_reward?: number
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      daily_question_usage: {
        Row: {
          created_at: string
          id: string
          questions_used: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          questions_used?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      essay_submissions: {
        Row: {
          cargo: string
          created_at: string
          error: string | null
          feedback: Json | null
          id: string
          line_count: number
          module_id: string
          score: number | null
          status: string
          tema: string
          texto: string
          user_id: string
        }
        Insert: {
          cargo: string
          created_at?: string
          error?: string | null
          feedback?: Json | null
          id?: string
          line_count: number
          module_id: string
          score?: number | null
          status?: string
          tema: string
          texto: string
          user_id: string
        }
        Update: {
          cargo?: string
          created_at?: string
          error?: string | null
          feedback?: Json | null
          id?: string
          line_count?: number
          module_id?: string
          score?: number | null
          status?: string
          tema?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_submissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_track_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_pass_purchases: {
        Row: {
          amount_cents: number | null
          created_at: string
          expires_at: string
          stripe_checkout_session_id: string
          track_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          expires_at: string
          stripe_checkout_session_id: string
          track_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          expires_at?: string
          stripe_checkout_session_id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_pass_purchases_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "study_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exam_items: {
        Row: {
          answered_at: string | null
          area: string
          exam_id: string
          is_correct: boolean | null
          points: number
          position: number
          question_id: string
          selected_index: number | null
        }
        Insert: {
          answered_at?: string | null
          area: string
          exam_id: string
          is_correct?: boolean | null
          points: number
          position: number
          question_id: string
          selected_index?: number | null
        }
        Update: {
          answered_at?: string | null
          area?: string
          exam_id?: string
          is_correct?: boolean | null
          points?: number
          position?: number
          question_id?: string
          selected_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_exam_items_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exam_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_exam_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exams: {
        Row: {
          approved: boolean | null
          area_scores: Json | null
          cargo: string
          correct_answers: number | null
          deadline: string
          finished_at: string | null
          id: string
          module_id: string
          score: number | null
          started_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          area_scores?: Json | null
          cargo: string
          correct_answers?: number | null
          deadline: string
          finished_at?: string | null
          id?: string
          module_id: string
          score?: number | null
          started_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          approved?: boolean | null
          area_scores?: Json | null
          cargo?: string
          correct_answers?: number | null
          deadline?: string
          finished_at?: string | null
          id?: string
          module_id?: string
          score?: number | null
          started_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_exams_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_track_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          icon: string | null
          id: string
          is_read: boolean
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          icon?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          icon?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          access_months: number | null
          access_revoked_at: string | null
          access_until_fixed: string | null
          amount_cents: number
          checkout_url: string | null
          commission_review: boolean
          created_at: string
          currency: string
          discount_cents: number
          expires_at: string
          id: string
          installments: number | null
          list_amount_cents: number
          live_mode: boolean
          paid_at: string | null
          payment_method_type: string | null
          possible_duplicate: boolean
          product: string
          provider: string
          provider_payment_id: string | null
          provider_preference_id: string | null
          provider_status: string | null
          provider_status_detail: string | null
          referral_code_id: string | null
          refunded_cents: number
          status: string
          track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_months?: number | null
          access_revoked_at?: string | null
          access_until_fixed?: string | null
          amount_cents: number
          checkout_url?: string | null
          commission_review?: boolean
          created_at?: string
          currency?: string
          discount_cents?: number
          expires_at: string
          id?: string
          installments?: number | null
          list_amount_cents: number
          live_mode?: boolean
          paid_at?: string | null
          payment_method_type?: string | null
          possible_duplicate?: boolean
          product: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_status?: string | null
          provider_status_detail?: string | null
          referral_code_id?: string | null
          refunded_cents?: number
          status?: string
          track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_months?: number | null
          access_revoked_at?: string | null
          access_until_fixed?: string | null
          amount_cents?: number
          checkout_url?: string | null
          commission_review?: boolean
          created_at?: string
          currency?: string
          discount_cents?: number
          expires_at?: string
          id?: string
          installments?: number | null
          list_amount_cents?: number
          live_mode?: boolean
          paid_at?: string | null
          payment_method_type?: string | null
          possible_duplicate?: boolean
          product?: string
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_status?: string | null
          provider_status_detail?: string | null
          referral_code_id?: string | null
          refunded_cents?: number
          status?: string
          track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "study_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_events: {
        Row: {
          event_id: string
          processed_at: string | null
          provider: string
          received_at: string
          resource_id: string | null
          topic: string
        }
        Insert: {
          event_id: string
          processed_at?: string | null
          provider: string
          received_at?: string
          resource_id?: string | null
          topic: string
        }
        Update: {
          event_id?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          resource_id?: string | null
          topic?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      premium_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          reason: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_tier: string
          created_at: string
          display_name: string | null
          id: string
          last_activity_date: string | null
          streak_days: number
          tier: string
          total_correct: number
          total_questions: number
          total_quizzes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          billing_tier?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          tier?: string
          total_correct?: number
          total_questions?: number
          total_quizzes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          billing_tier?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          tier?: string
          total_correct?: number
          total_questions?: number
          total_quizzes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_generation_runs: {
        Row: {
          created_at: string
          error: string | null
          id: number
          inserted: number
          model: string | null
          requested: number
          run_date: string
          status: string
          subject_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          inserted?: number
          model?: string | null
          requested?: number
          run_date?: string
          status: string
          subject_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          inserted?: number
          model?: string | null
          requested?: number
          run_date?: string
          status?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_generation_runs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      question_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          question_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          question_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          question_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      question_review_schedule: {
        Row: {
          box: number
          due_on: string
          lapses: number
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          box?: number
          due_on: string
          lapses?: number
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          box?: number
          due_on?: string
          lapses?: number
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_review_schedule_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_review_schedule_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          alternativas: string[]
          categoria: string
          content_hash: string | null
          correta: number
          created_at: string
          dificuldade: string
          enunciado: string
          explicacao: string | null
          id: string
          is_active: boolean
          is_premium: boolean
          nivel: string | null
          origem: string
          subject_id: string | null
          topico: string | null
          updated_at: string | null
        }
        Insert: {
          alternativas: string[]
          categoria?: string
          content_hash?: string | null
          correta: number
          created_at?: string
          dificuldade?: string
          enunciado: string
          explicacao?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          nivel?: string | null
          origem?: string
          subject_id?: string | null
          topico?: string | null
          updated_at?: string | null
        }
        Update: {
          alternativas?: string[]
          categoria?: string
          content_hash?: string | null
          correta?: number
          created_at?: string
          dificuldade?: string
          enunciado?: string
          explicacao?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          nivel?: string | null
          origem?: string
          subject_id?: string | null
          topico?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          categoria: string | null
          correct_answers: number
          created_at: string
          id: string
          score: number
          time_spent_seconds: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          categoria?: string | null
          correct_answers: number
          created_at?: string
          id?: string
          score: number
          time_spent_seconds?: number | null
          total_questions: number
          user_id: string
        }
        Update: {
          categoria?: string | null
          correct_answers?: number
          created_at?: string
          id?: string
          score?: number
          time_spent_seconds?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      radar_areas: {
        Row: {
          career_category_name: string | null
          description: string | null
          display_order: number
          focus: string
          icon: string
          id: string
          is_active: boolean
          name: string
          priority: number
          slug: string
        }
        Insert: {
          career_category_name?: string | null
          description?: string | null
          display_order?: number
          focus?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          slug: string
        }
        Update: {
          career_category_name?: string | null
          description?: string | null
          display_order?: number
          focus?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          slug?: string
        }
        Relationships: []
      }
      radar_concursos: {
        Row: {
          area_id: string | null
          banca: string | null
          cargos: string[]
          created_at: string
          data_prova: string | null
          escolaridade: string[]
          esfera: string | null
          first_seen_at: string
          id: string
          inscricoes_fim: string | null
          inscricoes_inicio: string | null
          is_published: boolean
          last_update_at: string
          link_oficial: string | null
          municipio: string | null
          nome: string
          orgao: string
          relevance: number
          salario_max: number | null
          slug: string
          source_id: string | null
          status: string
          track_id: string | null
          track_suggested: boolean
          uf: string | null
          vagas: number | null
        }
        Insert: {
          area_id?: string | null
          banca?: string | null
          cargos?: string[]
          created_at?: string
          data_prova?: string | null
          escolaridade?: string[]
          esfera?: string | null
          first_seen_at?: string
          id?: string
          inscricoes_fim?: string | null
          inscricoes_inicio?: string | null
          is_published?: boolean
          last_update_at?: string
          link_oficial?: string | null
          municipio?: string | null
          nome: string
          orgao: string
          relevance?: number
          salario_max?: number | null
          slug: string
          source_id?: string | null
          status?: string
          track_id?: string | null
          track_suggested?: boolean
          uf?: string | null
          vagas?: number | null
        }
        Update: {
          area_id?: string | null
          banca?: string | null
          cargos?: string[]
          created_at?: string
          data_prova?: string | null
          escolaridade?: string[]
          esfera?: string | null
          first_seen_at?: string
          id?: string
          inscricoes_fim?: string | null
          inscricoes_inicio?: string | null
          is_published?: boolean
          last_update_at?: string
          link_oficial?: string | null
          municipio?: string | null
          nome?: string
          orgao?: string
          relevance?: number
          salario_max?: number | null
          slug?: string
          source_id?: string | null
          status?: string
          track_id?: string | null
          track_suggested?: boolean
          uf?: string | null
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_concursos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "radar_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_concursos_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "radar_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_concursos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "study_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_follows: {
        Row: {
          area_id: string | null
          concurso_id: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          concurso_id?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          concurso_id?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_follows_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "radar_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_follows_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "radar_concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_runs: {
        Row: {
          candidates: number
          details: Json
          errors: number
          finished_at: string | null
          id: number
          sources_changed: number
          sources_checked: number
          started_at: string
          trigger: string
          updates_pending: number
          updates_published: number
        }
        Insert: {
          candidates?: number
          details?: Json
          errors?: number
          finished_at?: string | null
          id?: never
          sources_changed?: number
          sources_checked?: number
          started_at?: string
          trigger?: string
          updates_pending?: number
          updates_published?: number
        }
        Update: {
          candidates?: number
          details?: Json
          errors?: number
          finished_at?: string | null
          id?: never
          sources_changed?: number
          sources_checked?: number
          started_at?: string
          trigger?: string
          updates_pending?: number
          updates_published?: number
        }
        Relationships: []
      }
      radar_sources: {
        Row: {
          area_id: string | null
          check_interval_hours: number
          consecutive_failures: number
          created_at: string
          id: string
          is_active: boolean
          kind: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_hash: string | null
          last_status: string | null
          last_text: string | null
          name: string
          pending_retries: number
          url: string
        }
        Insert: {
          area_id?: string | null
          check_interval_hours?: number
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          last_status?: string | null
          last_text?: string | null
          name: string
          pending_retries?: number
          url: string
        }
        Update: {
          area_id?: string | null
          check_interval_hours?: number
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          last_status?: string | null
          last_text?: string | null
          name?: string
          pending_retries?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_sources_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "radar_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_track_drafts: {
        Row: {
          banca_profile: Json
          concurso_id: string
          created_at: string
          created_by: string | null
          draft: Json
          error: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          track_id: string | null
          warnings: string[]
        }
        Insert: {
          banca_profile?: Json
          concurso_id: string
          created_at?: string
          created_by?: string | null
          draft?: Json
          error?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          track_id?: string | null
          warnings?: string[]
        }
        Update: {
          banca_profile?: Json
          concurso_id?: string
          created_at?: string
          created_by?: string | null
          draft?: Json
          error?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          track_id?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "radar_track_drafts_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "radar_concursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_track_drafts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "study_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_updates: {
        Row: {
          changes: Json
          concurso_id: string
          created_at: string
          evidence_url: string | null
          id: string
          kind: string
          notified_at: string | null
          patch: Json
          review_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source_id: string | null
          summary: string | null
          title: string
        }
        Insert: {
          changes?: Json
          concurso_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          kind?: string
          notified_at?: string | null
          patch?: Json
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          changes?: Json
          concurso_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          kind?: string
          notified_at?: string | null
          patch?: Json
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "radar_updates_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "radar_concursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_updates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "radar_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          ip_address: string | null
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          ip_address?: string | null
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          ip_address?: string | null
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          commission_percent: number
          created_at: string
          created_by: string | null
          discount_percent: number
          id: string
          is_active: boolean
          notes: string | null
          revoked_at: string | null
          revoked_reason: string | null
          source: string
          total_earnings: number
          total_uses: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source?: string
          total_earnings?: number
          total_uses?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          source?: string
          total_earnings?: number
          total_uses?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_link_visits: {
        Row: {
          referral_code_id: string
          visit_date: string
          visits: number
        }
        Insert: {
          referral_code_id: string
          visit_date: string
          visits?: number
        }
        Update: {
          referral_code_id?: string
          visit_date?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_link_visits_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_uses: {
        Row: {
          commission_earned: number | null
          created_at: string
          id: string
          referral_code_id: string
          referred_user_id: string | null
          stripe_checkout_session_id: string | null
          subscription_amount: number | null
        }
        Insert: {
          commission_earned?: number | null
          created_at?: string
          id?: string
          referral_code_id: string
          referred_user_id?: string | null
          stripe_checkout_session_id?: string | null
          subscription_amount?: number | null
        }
        Update: {
          commission_earned?: number | null
          created_at?: string
          id?: string
          referral_code_id?: string
          referred_user_id?: string | null
          stripe_checkout_session_id?: string | null
          subscription_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      review_daily_usage: {
        Row: {
          reviews_done: number
          usage_date: string
          user_id: string
        }
        Insert: {
          reviews_done?: number
          usage_date: string
          user_id: string
        }
        Update: {
          reviews_done?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_catalog: {
        Row: {
          available_for_tier: string
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          max_redemptions: number | null
          name: string
          points_cost: number
          reward_type: string
          reward_value: Json
        }
        Insert: {
          available_for_tier?: string
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          name: string
          points_cost: number
          reward_type: string
          reward_value: Json
        }
        Update: {
          available_for_tier?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          name?: string
          points_cost?: number
          reward_type?: string
          reward_value?: Json
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          id: string
          received_at: string
          type: string
        }
        Insert: {
          id: string
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      study_track_modules: {
        Row: {
          cargos: string[]
          description: string | null
          display_order: number
          id: string
          name: string
          nivel: string
          slug: string
          structure: Json
          track_id: string
        }
        Insert: {
          cargos?: string[]
          description?: string | null
          display_order?: number
          id?: string
          name: string
          nivel: string
          slug: string
          structure?: Json
          track_id: string
        }
        Update: {
          cargos?: string[]
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          nivel?: string
          slug?: string
          structure?: Json
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_track_modules_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "study_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_track_subjects: {
        Row: {
          ai_grounded_only: boolean
          area: string
          cargo: string | null
          display_order: number
          id: string
          module_id: string
          study_tips: string | null
          subject_id: string
          syllabus: string | null
          weekly_target: number
        }
        Insert: {
          ai_grounded_only?: boolean
          area: string
          cargo?: string | null
          display_order?: number
          id?: string
          module_id: string
          study_tips?: string | null
          subject_id: string
          syllabus?: string | null
          weekly_target?: number
        }
        Update: {
          ai_grounded_only?: boolean
          area?: string
          cargo?: string | null
          display_order?: number
          id?: string
          module_id?: string
          study_tips?: string | null
          subject_id?: string
          syllabus?: string | null
          weekly_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_track_subjects_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "study_track_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_track_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_tracks: {
        Row: {
          banca: string
          created_at: string
          description: string | null
          edital_url: string | null
          exam_date: string | null
          id: string
          is_active: boolean
          name: string
          organ: string
          rules: Json
          short_name: string
          slug: string
        }
        Insert: {
          banca: string
          created_at?: string
          description?: string | null
          edital_url?: string | null
          exam_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          organ: string
          rules?: Json
          short_name: string
          slug: string
        }
        Update: {
          banca?: string
          created_at?: string
          description?: string | null
          edital_url?: string | null
          exam_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organ?: string
          rules?: Json
          short_name?: string
          slug?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          career_category_id: string
          created_at: string
          description: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          name: string
          slug: string | null
        }
        Insert: {
          career_category_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
        }
        Update: {
          career_category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_career_category_id_fkey"
            columns: ["career_category_id"]
            isOneToOne: false
            referencedRelation: "career_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          quiz_result_id: string | null
          selected_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          quiz_result_id?: string | null
          selected_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          quiz_result_id?: string | null
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_quiz_result_id_fkey"
            columns: ["quiz_result_id"]
            isOneToOne: false
            referencedRelation: "quiz_results"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_at: string
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string | null
          user_id: string
        }
        Insert: {
          ban_type?: string
          banned_at?: string
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_at?: string
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_daily_challenges: {
        Row: {
          challenge_date: string
          challenge_id: string
          completed_at: string | null
          created_at: string
          current_progress: number
          id: string
          is_completed: boolean
          points_claimed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_date?: string
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          is_completed?: boolean
          points_claimed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_date?: string
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          is_completed?: boolean
          points_claimed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          achieved_at: string
          id: string
          milestone_type: string
          milestone_value: number
          notification_shown: boolean
          user_id: string
        }
        Insert: {
          achieved_at?: string
          id?: string
          milestone_type: string
          milestone_value: number
          notification_shown?: boolean
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          milestone_type?: string
          milestone_value?: number
          notification_shown?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_question_attempts: {
        Row: {
          created_at: string
          id: number
          is_correct: boolean
          question_id: string
          selected_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_correct: boolean
          question_id: string
          selected_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          is_correct?: boolean
          question_id?: string
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_redemptions: {
        Row: {
          expires_at: string | null
          id: string
          points_spent: number
          redeemed_at: string
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          points_spent: number
          redeemed_at?: string
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          points_spent?: number
          redeemed_at?: string
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          consecutive_correct: number
          created_at: string
          current_level: number
          daily_points_date: string | null
          daily_points_earned: number
          id: string
          last_session_date: string | null
          max_consecutive_correct: number
          total_points: number
          total_time_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_correct?: number
          created_at?: string
          current_level?: number
          daily_points_date?: string | null
          daily_points_earned?: number
          id?: string
          last_session_date?: string | null
          max_consecutive_correct?: number
          total_points?: number
          total_time_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_correct?: number
          created_at?: string
          current_level?: number
          daily_points_date?: string | null
          daily_points_earned?: number
          id?: string
          last_session_date?: string | null
          max_consecutive_correct?: number
          total_points?: number
          total_time_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      questions_public: {
        Row: {
          alternativas: string[] | null
          categoria: string | null
          created_at: string | null
          dificuldade: string | null
          enunciado: string | null
          id: string | null
          is_premium: boolean | null
          nivel: string | null
          origem: string | null
          subject_id: string | null
          topico: string | null
        }
        Insert: {
          alternativas?: string[] | null
          categoria?: string | null
          created_at?: string | null
          dificuldade?: string | null
          enunciado?: string | null
          id?: string | null
          is_premium?: boolean | null
          nivel?: string | null
          origem?: string | null
          subject_id?: string | null
          topico?: string | null
        }
        Update: {
          alternativas?: string[] | null
          categoria?: string | null
          created_at?: string | null
          dificuldade?: string | null
          enunciado?: string | null
          id?: string | null
          is_premium?: boolean | null
          nivel?: string | null
          origem?: string | null
          subject_id?: string | null
          topico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _access_level: { Args: { p_user_id: string }; Returns: string }
      _active_premium_grant: {
        Args: { p_user_id: string }
        Returns: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          reason: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "premium_grants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _audit: {
        Args: { p_event: string; p_metadata: Json }
        Returns: undefined
      }
      _avatar_from_meta: { Args: { p_meta: Json }; Returns: string }
      _ban_outranks: {
        Args: { p_actor: string; p_target: string }
        Returns: boolean
      }
      _can_moderate: {
        Args: { p_actor: string; p_target: string }
        Returns: boolean
      }
      _display_name_from_meta: { Args: { p_meta: Json }; Returns: string }
      _essay_used_7d: { Args: { p_user_id: string }; Returns: number }
      _has_paid_access: { Args: { p_user_id: string }; Returns: boolean }
      _has_premium_grant: { Args: { p_user_id: string }; Returns: boolean }
      _has_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      _is_master: { Args: { p_user_id: string }; Returns: boolean }
      _level_rank: { Args: { p_level: string }; Returns: number }
      _mp_order_status: {
        Args: {
          p_amount_cents: number
          p_refunded_cents: number
          p_status: string
        }
        Returns: string
      }
      _paid_access_until: { Args: { p_user_id: string }; Returns: string }
      _premium_source: {
        Args: { p_billing_tier: string; p_user_id: string }
        Returns: string
      }
      _refresh_profile_tier: { Args: { p_user_id: string }; Returns: string }
      _review_interval: {
        Args: { p_box: number; p_question_id: string }
        Returns: number
      }
      _today_local: { Args: never; Returns: string }
      admin_add_affiliate: {
        Args: {
          p_code?: string
          p_commission_percent?: number
          p_discount_percent?: number
          p_email?: string
          p_notes?: string
          p_user_id?: string
        }
        Returns: Json
      }
      admin_affiliate_overview: { Args: never; Returns: Json }
      admin_ban_user: {
        Args: {
          p_ban_type: string
          p_days?: number
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_get_settings: { Args: never; Returns: Json }
      admin_grant_premium: {
        Args: { p_days?: number; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      admin_list_audit_logs: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          actor_email: string
          actor_name: string
          created_at: string
          error_message: string
          event_type: string
          id: string
          ip_address: string
          metadata: Json
          success: boolean
          target_name: string
        }[]
      }
      admin_list_question_reports: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json
      }
      admin_list_questions: {
        Args: {
          p_categoria?: string
          p_limit?: number
          p_offset?: number
          p_origem?: string
          p_premium?: boolean
          p_search?: string
          p_sort?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_list_users: {
        Args: {
          p_filter?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          access_level: string
          affiliate_code: string
          affiliate_status: string
          ban_expires_at: string
          ban_reason: string
          ban_type: string
          can_moderate: boolean
          created_at: string
          display_name: string
          email: string
          has_premium_grant: boolean
          is_banned: boolean
          last_sign_in_at: string
          premium_grant_expires_at: string
          premium_grant_reason: string
          premium_source: string
          streak_days: number
          tier: string
          total_correct: number
          total_count: number
          total_questions: number
          total_quizzes: number
          user_id: string
        }[]
      }
      admin_platform_overview: { Args: never; Returns: Json }
      admin_register_payout: {
        Args: {
          p_amount: number
          p_method?: string
          p_notes?: string
          p_paid_at?: string
          p_reference?: string
          p_referral_code_id: string
        }
        Returns: Json
      }
      admin_remove_affiliate: {
        Args: { p_reason?: string; p_referral_code_id: string }
        Returns: Json
      }
      admin_resolve_question_report: {
        Args: {
          p_apply_to_question?: boolean
          p_note?: string
          p_report_id: string
          p_status: string
        }
        Returns: Json
      }
      admin_revoke_premium: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      admin_set_access_level: {
        Args: { p_level: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      admin_unban_user: { Args: { p_user_id: string }; Returns: Json }
      admin_update_affiliate: {
        Args: {
          p_commission_percent?: number
          p_discount_percent?: number
          p_is_active?: boolean
          p_notes?: string
          p_referral_code_id: string
        }
        Returns: Json
      }
      admin_update_question: {
        Args: { p_patch: Json; p_question_id: string }
        Returns: Json
      }
      admin_update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      affiliate_default_terms: { Args: never; Returns: Json }
      affiliate_self_enrollment_enabled: { Args: never; Returns: boolean }
      apply_mp_payment: {
        Args: {
          p_amount_cents: number
          p_approved_at: string
          p_currency: string
          p_installments: number
          p_live_mode: boolean
          p_method_type: string
          p_order_id: string
          p_payment_id: string
          p_refunded_cents: number
          p_status: string
          p_status_detail: string
        }
        Returns: Json
      }
      begin_essay_submission: {
        Args: {
          p_cargo: string
          p_limit?: number
          p_line_count: number
          p_module_id: string
          p_tema: string
          p_texto: string
          p_user_id: string
        }
        Returns: string
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_audit_logs: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      consume_ai_mentor_quota: {
        Args: { p_limit: number; p_user_id: string }
        Returns: boolean
      }
      create_payment_order: {
        Args: {
          p_access_until_fixed: string
          p_discount_cents: number
          p_list_amount_cents: number
          p_live_mode?: boolean
          p_product: string
          p_referral_code_id: string
          p_track_id: string
          p_ttl_minutes?: number
          p_user_id: string
        }
        Returns: Json
      }
      expire_premium_grants: { Args: never; Returns: number }
      finish_mock_exam: { Args: { p_exam_id: string }; Returns: Json }
      get_affiliate_dashboard: {
        Args: { p_months?: number; p_referral_code_id?: string }
        Returns: Json
      }
      get_essay_quota: { Args: never; Returns: Json }
      get_leaderboard: {
        Args: { limit_count?: number; period?: string }
        Returns: {
          correct_answers: number
          created_at: string
          display_name: string
          id: string
          is_current_user: boolean
          score: number
          total_questions: number
        }[]
      }
      get_mock_exam: {
        Args: { p_exam_id: string }
        Returns: {
          alternativas: string[]
          area: string
          enunciado: string
          points: number
          pos: number
          question_id: string
          selected_index: number
          subject_id: string
        }[]
      }
      get_mock_exam_standing: { Args: { p_exam_id: string }; Returns: Json }
      get_my_access: { Args: never; Returns: Json }
      get_my_payment_orders: { Args: { p_limit?: number }; Returns: Json }
      get_practice_questions: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_nivel?: string
          p_subject_id: string
        }
        Returns: {
          alternativas: string[]
          categoria: string
          created_at: string
          dificuldade: string
          enunciado: string
          id: string
          is_premium: boolean
          nivel: string
          origem: string
          subject_id: string
          topico: string
        }[]
      }
      get_premium_access: { Args: { p_user_id?: string }; Returns: Json }
      get_question_cron_secret: { Args: never; Returns: string }
      get_quiz_questions: {
        Args: { p_categoria?: string; p_limit?: number }
        Returns: {
          alternativas: string[]
          categoria: string
          created_at: string
          dificuldade: string
          enunciado: string
          id: string
          is_premium: boolean
          nivel: string
          origem: string
          subject_id: string
          topico: string
        }[]
      }
      get_review_queue: { Args: { p_limit?: number }; Returns: Json }
      get_track_progress: {
        Args: { p_module_id: string }
        Returns: {
          answered: number
          attempts_7d: number
          correct_latest: number
          new_this_week: number
          subject_id: string
          total_questions: number
          wrong_latest: number
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_tier: { Args: { p_user_id: string }; Returns: string }
      grant_exam_pass: {
        Args: {
          p_amount_cents?: number
          p_session_id: string
          p_track_id: string
          p_user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_daily_usage: {
        Args: { p_count?: number; p_date: string; p_user_id: string }
        Returns: number
      }
      is_user_banned: { Args: { p_user_id: string }; Returns: boolean }
      level_for_points: { Args: { p_points: number }; Returns: number }
      master_admin_email: { Args: never; Returns: string }
      purge_old_ai_runs: { Args: never; Returns: number }
      radar_apply_patch: {
        Args: { p: Json; p_concurso_id: string }
        Returns: undefined
      }
      radar_fanout_update: { Args: { p_update_id: string }; Returns: number }
      radar_follower_counts: {
        Args: never
        Returns: {
          concurso_id: string
          followers: number
        }[]
      }
      radar_publish_track_draft: {
        Args: { p_draft_id: string }
        Returns: string
      }
      radar_review_update: {
        Args: { p_approve: boolean; p_reason?: string; p_update_id: string }
        Returns: number
      }
      record_ai_lessons: {
        Args: { p_lessons: string[]; p_source: string; p_subject_id: string }
        Returns: number
      }
      record_referral_conversion: {
        Args: {
          p_amount: number
          p_checkout_session_id: string
          p_referral_code_id: string
          p_referred_user_id: string
        }
        Returns: Json
      }
      redeem_reward: {
        Args: { p_points_cost: number; p_reward_id: string; p_user_id: string }
        Returns: Json
      }
      report_question: {
        Args: { p_details?: string; p_question_id: string; p_reason: string }
        Returns: Json
      }
      save_mock_answer: {
        Args: {
          p_exam_id: string
          p_question_id: string
          p_selected_index: number
        }
        Returns: Json
      }
      start_mock_exam: {
        Args: { p_cargo: string; p_module_id: string }
        Returns: Json
      }
      track_referral_visit: { Args: { p_code: string }; Returns: undefined }
      validate_answer: {
        Args: { p_question_id: string; p_selected_index: number }
        Returns: Json
      }
      validate_referral_code: {
        Args: { code_to_validate: string }
        Returns: {
          code: string
          discount_percent: number
          id: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

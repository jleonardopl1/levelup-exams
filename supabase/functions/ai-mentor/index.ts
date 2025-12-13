import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user from JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.id);

    // Check subscription tier from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tier")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError.message);
      return new Response(JSON.stringify({ error: "Erro ao verificar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile?.tier !== "plus") {
      console.log("User tier:", profile?.tier, "- Access denied");
      return new Response(JSON.stringify({ error: "O Mentor IA é exclusivo para assinantes Plus!" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily usage limits server-side
    const today = new Date().toISOString().split('T')[0];
    const { data: usage, error: usageError } = await supabase
      .from("ai_mentor_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usageError) {
      console.error("Usage fetch error:", usageError.message);
    }

    if (usage && usage.questions_used >= DAILY_LIMIT) {
      console.log("Daily limit reached for user:", user.id);
      return new Response(JSON.stringify({ error: "Limite diário de perguntas atingido. Tente novamente amanhã!" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment usage counter
    if (usage) {
      await supabase
        .from("ai_mentor_usage")
        .update({ questions_used: usage.questions_used + 1, updated_at: new Date().toISOString() })
        .eq("id", usage.id);
    } else {
      await supabase
        .from("ai_mentor_usage")
        .insert({ user_id: user.id, usage_date: today, questions_used: 1 });
    }

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("AI Mentor request received with messages:", messages.length, "from user:", user.id);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `Você é o Mentor IA do LevelUp Exams, um especialista em educação focado em ajudar estudantes a se prepararem para vestibulares, ENEM e concursos públicos.

Suas responsabilidades:
- Esclarecer dúvidas sobre qualquer tema de estudo (matemática, português, história, geografia, física, química, biologia, etc.)
- Explicar conceitos de forma clara e didática
- Fornecer dicas de estudo e memorização
- Ajudar a resolver questões passo a passo
- Indicar estratégias para provas

Diretrizes:
- Seja didático e paciente
- Use exemplos práticos quando possível
- Estruture suas respostas de forma clara
- Se a pergunta for muito ampla, peça mais detalhes
- Responda sempre em português brasileiro

Lembre-se: você é um mentor dedicado ao sucesso do estudante!`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente mais tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao conectar com o Mentor IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("AI Mentor streaming response started for user:", user.id);

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Mentor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

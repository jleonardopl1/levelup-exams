import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 6;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

// Rate limiting helper
async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart)
    .maybeSingle();

  if (existing) {
    if (existing.request_count >= RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, remaining: 0 };
    }
    
    await supabase
      .from("rate_limits")
      .update({ 
        request_count: existing.request_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id);
    
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.request_count - 1 };
  }

  await supabase
    .from("rate_limits")
    .upsert({
      identifier,
      endpoint,
      request_count: 1,
      window_start: new Date().toISOString()
    }, { onConflict: "identifier,endpoint" });

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
}

// Audit logging helper
async function logAuditEvent(
  supabase: any,
  eventType: string,
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  ipAddress: string | null,
  userAgent: string | null,
  success: boolean,
  errorMessage: string | null = null,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from("audit_logs").insert({
      event_type: eventType,
      user_id: userId,
      user_email: userEmail,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
      error_message: errorMessage,
      metadata
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check rate limit by IP first
    const rateLimitResult = await checkRateLimit(supabase, clientIp, "ai-mentor");
    if (!rateLimitResult.allowed) {
      await logAuditEvent(
        supabase, "RATE_LIMIT_EXCEEDED", null, null, clientIp, userAgent, false,
        "Rate limit exceeded for ai-mentor endpoint"
      );
      return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await logAuditEvent(supabase, "AUTH_FAILED", null, null, clientIp, userAgent, false, "No authorization header");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      await logAuditEvent(supabase, "AUTH_FAILED", null, null, clientIp, userAgent, false, authError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tier")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      await logAuditEvent(supabase, "PROFILE_ERROR", user.id, user.email, clientIp, userAgent, false, profileError.message);
      return new Response(JSON.stringify({ error: "Erro ao verificar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile?.tier !== "plus") {
      await logAuditEvent(supabase, "ACCESS_DENIED", user.id, user.email, clientIp, userAgent, false, "Non-plus user", { tier: profile?.tier });
      return new Response(JSON.stringify({ error: "O Mentor IA é exclusivo para assinantes Plus!" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabase
      .from("ai_mentor_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usage && usage.questions_used >= DAILY_LIMIT) {
      await logAuditEvent(supabase, "DAILY_LIMIT_REACHED", user.id, user.email, clientIp, userAgent, false, "Daily limit reached");
      return new Response(JSON.stringify({ error: "Limite diário de perguntas atingido. Tente novamente amanhã!" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (usage) {
      await supabase.from("ai_mentor_usage").update({ questions_used: usage.questions_used + 1, updated_at: new Date().toISOString() }).eq("id", usage.id);
    } else {
      await supabase.from("ai_mentor_usage").insert({ user_id: user.id, usage_date: today, questions_used: 1 });
    }

    const body = await req.json();
    
    // Validate messages structure
    if (!body.messages || !Array.isArray(body.messages)) {
      await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Invalid request format - messages not an array");
      return new Response(JSON.stringify({ error: "Formato de requisição inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = body.messages;

    // Limit message count (conversation history)
    if (messages.length > 20) {
      await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Message count exceeded", { count: messages.length });
      return new Response(JSON.stringify({ error: "Limite de mensagens excedido (máximo 20)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Invalid message format");
        return new Response(JSON.stringify({ error: "Formato de mensagem inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (typeof msg.content !== 'string') {
        await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Message content not a string");
        return new Response(JSON.stringify({ error: "Conteúdo da mensagem deve ser texto" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Limit message length (4000 chars)
      if (msg.content.length > 4000) {
        await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Message too long", { length: msg.content.length });
        return new Response(JSON.stringify({ error: "Mensagem muito longa (máximo 4000 caracteres)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Only allow user and assistant roles
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, user.email, clientIp, userAgent, false, "Invalid message role", { role: msg.role });
        return new Response(JSON.stringify({ error: "Função de mensagem inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAuditEvent(supabase, "AI_MENTOR_REQUEST", user.id, user.email, clientIp, userAgent, true, null, { messages_count: messages.length });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `Você é o Mentor IA do LevelUp Exams, um especialista em educação focado em ajudar estudantes a se prepararem para vestibulares, ENEM e concursos públicos.

Suas responsabilidades:
- Esclarecer dúvidas sobre qualquer tema de estudo
- Explicar conceitos de forma clara e didática
- Fornecer dicas de estudo e memorização
- Ajudar a resolver questões passo a passo
- Indicar estratégias para provas

Diretrizes:
- Seja didático e paciente
- Use exemplos práticos quando possível
- Estruture suas respostas de forma clara
- Responda sempre em português brasileiro

Lembre-se: você é um mentor dedicado ao sucesso do estudante!`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Erro ao conectar com o Mentor IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (error) {
    console.error("AI Mentor error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

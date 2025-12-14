import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MS = 300000;
const RATE_LIMIT_MAX_REQUESTS = 3;

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

const escapeHtml = (str: string): string => {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

async function checkRateLimit(supabase: any, identifier: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: existing } = await supabase.from("rate_limits").select("*").eq("identifier", identifier).eq("endpoint", endpoint).gte("window_start", windowStart).maybeSingle();

  if (existing) {
    if (existing.request_count >= RATE_LIMIT_MAX_REQUESTS) return { allowed: false, remaining: 0 };
    await supabase.from("rate_limits").update({ request_count: existing.request_count + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.request_count - 1 };
  }

  await supabase.from("rate_limits").upsert({ identifier, endpoint, request_count: 1, window_start: new Date().toISOString() }, { onConflict: "identifier,endpoint" });
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
}

async function logAuditEvent(supabase: any, eventType: string, userId: string | null | undefined, userEmail: string | null | undefined, ipAddress: string | null, userAgent: string | null, success: boolean, errorMessage: string | null = null, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from("audit_logs").insert({ event_type: eventType, user_id: userId, user_email: userEmail, ip_address: ipAddress, user_agent: userAgent, success, error_message: errorMessage, metadata });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: "Simulados Concursos <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) throw new Error(`Failed to send email: ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const rateLimitResult = await checkRateLimit(supabase, clientIp, "send-contact");
    if (!rateLimitResult.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", null, null, clientIp, userAgent, false, "Rate limit exceeded");
      return new Response(JSON.stringify({ error: "Muitas mensagens enviadas. Aguarde alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" } });
    }

    const { name, email, message }: ContactRequest = await req.json();

    if (!name || !email || !message) {
      await logAuditEvent(supabase, "CONTACT_VALIDATION_FAILED", null, email, clientIp, userAgent, false, "Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (name.length > 100 || email.length > 255 || message.length > 2000) {
      await logAuditEvent(supabase, "CONTACT_VALIDATION_FAILED", null, email, clientIp, userAgent, false, "Field length exceeded");
      return new Response(JSON.stringify({ error: "Field length exceeded" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await logAuditEvent(supabase, "CONTACT_VALIDATION_FAILED", null, email, clientIp, userAgent, false, "Invalid email format");
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    await sendEmail(["contato@simuladosconcursos.com.br"], `Nova mensagem de contato: ${safeName}`, `<h2>Nova mensagem de contato</h2><p><strong>Nome:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Mensagem:</strong></p><p>${safeMessage}</p>`);
    await sendEmail([email], "Recebemos sua mensagem!", `<h1>Olá, ${safeName}!</h1><p>Recebemos sua mensagem e responderemos em breve.</p><p><strong>Sua mensagem:</strong></p><p style="background: #f4f4f4; padding: 12px; border-radius: 8px;">${safeMessage}</p><p>Atenciosamente,<br>Equipe Simulados Concursos</p>`);

    await logAuditEvent(supabase, "CONTACT_SENT", null, email, clientIp, userAgent, true, null, { name: safeName });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-contact function:", errorMessage);
    await logAuditEvent(supabase, "CONTACT_ERROR", null, null, clientIp, userAgent, false, errorMessage);
    return new Response(JSON.stringify({ error: "An error occurred sending your message" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

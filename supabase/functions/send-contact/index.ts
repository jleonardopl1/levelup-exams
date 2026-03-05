import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { escapeHtml, checkRateLimit, logAuditEvent } from "../_shared/utils.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const RATE_LIMIT_WINDOW_MS = 300000;
const RATE_LIMIT_MAX_REQUESTS = 3;

interface ContactRequest {
  name: string;
  email: string;
  message: string;
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
    const rateLimitResult = await checkRateLimit(supabase, clientIp, "send-contact", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
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

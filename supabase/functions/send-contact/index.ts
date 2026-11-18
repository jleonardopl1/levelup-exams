import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  escapeHtml,
  getClientIp,
  jsonResponse,
  logAuditEvent,
  readJson,
  stripControlChars,
} from "../_shared/utils.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CONTACT_INBOX = Deno.env.get("CONTACT_INBOX") || "contato@levelupexams.com.br";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "LevelUp Exams <onboarding@resend.dev>";

const RATE_LIMIT_WINDOW_MS = 300000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const GLOBAL_HOURLY_MAX = 60;
const EMAIL_RE = /^[^\s@<>"',;:()[\]\\]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

async function sendEmail(payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: MAIL_FROM, ...payload }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`email provider status ${res.status}`);
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    if (!RESEND_API_KEY) return jsonResponse({ error: "Serviço indisponível" }, 503);

    const body = await readJson<Record<string, unknown>>(req, 16 * 1024);
    if (!body) return jsonResponse({ error: "Requisição inválida" }, 400);

    const name = typeof body.name === "string" ? stripControlChars(body.name) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message) return jsonResponse({ error: "Preencha todos os campos" }, 400);
    if (name.length > 100 || email.length > 254 || message.length > 2000) {
      return jsonResponse({ error: "Campos excedem o tamanho permitido" }, 400);
    }
    if (!EMAIL_RE.test(email)) return jsonResponse({ error: "E-mail inválido" }, 400);

    // Limites: por IP, por endereco informado e global (protege a reputacao do dominio).
    const [byIp, byEmail, global] = await Promise.all([
      checkRateLimit(supabase, `ip:${clientIp}`, "send-contact", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS),
      checkRateLimit(supabase, `email:${email}`, "send-contact", 3600000, 2),
      checkRateLimit(supabase, "global", "send-contact", 3600000, GLOBAL_HOURLY_MAX),
    ]);
    if (!byIp.allowed || !byEmail.allowed || !global.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", null, null, clientIp, userAgent, false, "send-contact");
      return jsonResponse({ error: "Muitas mensagens enviadas. Aguarde alguns minutos." }, 429, { "Retry-After": "300" });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    // 1) Mensagem para a caixa interna (reply_to = remetente).
    await sendEmail({
      to: [CONTACT_INBOX],
      reply_to: email,
      subject: `Nova mensagem de contato: ${name.slice(0, 80)}`,
      html: `<h2>Nova mensagem de contato</h2><p><strong>Nome:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Mensagem:</strong></p><p>${safeMessage}</p>`,
    });

    // 2) Confirmacao ao remetente SEM ecoar nome/mensagem: impede o uso do formulario
    //    como relay de spam/phishing com conteudo arbitrario para terceiros.
    await sendEmail({
      to: [email],
      subject: "Recebemos sua mensagem",
      html: `<p>Olá!</p><p>Recebemos sua mensagem e responderemos em breve.</p><p>Se você não enviou esta mensagem, ignore este e-mail.</p><p>Atenciosamente,<br>Equipe LevelUp Exams</p>`,
    });

    await logAuditEvent(supabase, "CONTACT_SENT", null, null, clientIp, userAgent, true);
    return jsonResponse({ success: true });
  } catch {
    console.error("send-contact error");
    await logAuditEvent(supabase, "CONTACT_ERROR", null, null, clientIp, userAgent, false, "send failure");
    return jsonResponse({ error: "Não foi possível enviar sua mensagem" }, 500);
  }
}));

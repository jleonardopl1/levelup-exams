import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  escapeHtml,
  getClientIp,
  jsonResponse,
  readJson,
  requireAdmin,
  stripControlChars,
  UUID_RE,
} from "../_shared/utils.ts";

const ALLOWED_ACTIONS = ["user_banned", "user_unbanned", "role_assigned", "role_revoked"] as const;
type Action = typeof ALLOWED_ACTIONS[number];
const ALLOWED_ROLES = ["admin", "moderator", "user"];
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "LevelUp Exams <onboarding@resend.dev>";

const clip = (v: unknown, max: number) => (typeof v === "string" ? stripControlChars(v).slice(0, max) : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const auth = await requireAdmin(supabase, req);
    if ("error" in auth) return auth.error;
    const admin = auth.user;

    const rl = await checkRateLimit(supabase, `user:${admin.id}`, "admin-notify", 60000, 30);
    if (!rl.allowed) return jsonResponse({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });

    const body = await readJson<Record<string, unknown>>(req, 8 * 1024);
    const action = body?.action as Action;
    const targetUserId = body?.targetUserId;
    if (!body || !ALLOWED_ACTIONS.includes(action)) return jsonResponse({ error: "Invalid action type" }, 400);
    if (typeof targetUserId !== "string" || !UUID_RE.test(targetUserId)) {
      return jsonResponse({ error: "Invalid target" }, 400);
    }
    if (targetUserId === admin.id && (action === "user_banned" || action === "role_revoked")) {
      return jsonResponse({ error: "Ação não permitida sobre a própria conta" }, 400);
    }

    const rawDetails = (body.details && typeof body.details === "object") ? body.details as Record<string, unknown> : {};
    // Whitelist de campos (antes: spread arbitrario do objeto do cliente no log de auditoria).
    const details = {
      reason: clip(rawDetails.reason, 500),
      role: ALLOWED_ROLES.includes(String(rawDetails.role)) ? String(rawDetails.role) : "",
      ban_type: rawDetails.ban_type === "permanent" ? "permanent" : "temporary",
      ban_days: /^\d{1,4}$/.test(String(rawDetails.ban_days ?? "")) ? String(rawDetails.ban_days) : "",
    };
    const targetName = clip(body.targetName, 100);

    const { data: targetUser } = await supabase.auth.admin.getUserById(targetUserId);
    if (!targetUser?.user) return jsonResponse({ error: "Usuário não encontrado" }, 404);
    const targetEmail = targetUser.user.email;

    // Banimento EFETIVO: antes o ban so era gravado em user_bans e nada o aplicava
    // (o usuario banido continuava logando e usando a API).
    if (action === "user_banned") {
      const { data: activeBan } = await supabase.rpc("is_user_banned", { p_user_id: targetUserId });
      if (activeBan !== true) return jsonResponse({ error: "Nenhum banimento ativo registrado" }, 409);
      const days = details.ban_type === "permanent" ? 36500 : Math.max(1, Number(details.ban_days || "1"));
      // Com ban_duration o GoTrue recusa login e refresh; o access token atual expira
      // naturalmente e as Edge Functions ja recusam usuarios banidos (requireUser).
      await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: `${days * 24}h` });
    } else if (action === "user_unbanned") {
      const { data: stillBanned } = await supabase.rpc("is_user_banned", { p_user_id: targetUserId });
      if (stillBanned !== true) {
        await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
      }
    }

    await supabase.from("audit_logs").insert({
      user_id: admin.id,
      user_email: admin.email,
      event_type: action,
      ip_address: getClientIp(req),
      success: true,
      metadata: { target_user_id: targetUserId, target_name: targetName, ...details },
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && targetEmail) {
      const safeName = escapeHtml(targetName || "");
      const safeReason = escapeHtml(details.reason);
      const safeRole = escapeHtml(details.role);
      const safeBanDays = details.ban_days ? escapeHtml(details.ban_days) : "alguns";

      let subject = "";
      let htmlBody = "";
      switch (action) {
        case "user_banned":
          subject = "Sua conta foi suspensa - LevelUp Exams";
          htmlBody = `<h2>Sua conta foi suspensa</h2><p>Olá ${safeName},</p><p>Informamos que sua conta no LevelUp Exams foi <strong>${details.ban_type === "permanent" ? "banida permanentemente" : `suspensa temporariamente por ${safeBanDays} dias`}</strong>.</p>${safeReason ? `<p><strong>Motivo:</strong> ${safeReason}</p>` : ""}<p>Se você acredita que houve um engano, entre em contato com o suporte.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
          break;
        case "user_unbanned":
          subject = "Sua conta foi reativada - LevelUp Exams";
          htmlBody = `<h2>Sua conta foi reativada</h2><p>Olá ${safeName},</p><p>Informamos que sua conta no LevelUp Exams foi <strong>reativada</strong>. Você já pode acessar a plataforma normalmente.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
          break;
        case "role_assigned":
          if (!safeRole) break;
          subject = "Nova permissão atribuída - LevelUp Exams";
          htmlBody = `<h2>Nova permissão atribuída</h2><p>Olá ${safeName},</p><p>Você recebeu a permissão de <strong>${safeRole}</strong> no LevelUp Exams.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
          break;
        case "role_revoked":
          if (!safeRole) break;
          subject = "Permissão removida - LevelUp Exams";
          htmlBody = `<h2>Permissão removida</h2><p>Olá ${safeName},</p><p>A permissão de <strong>${safeRole}</strong> foi removida da sua conta no LevelUp Exams.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
          break;
      }

      if (subject && htmlBody) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({ from: MAIL_FROM, to: [targetEmail], subject, html: htmlBody }),
            signal: AbortSignal.timeout(15000),
          });
        } catch {
          console.error("Email send error");
        }
      }
    }

    return jsonResponse({ success: true });
  } catch {
    console.error("admin-notify error");
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});

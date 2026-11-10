import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  escapeHtml,
  getAccessLevel,
  jsonResponse,
  readJson,
  requireStaff,
  stripControlChars,
  UUID_RE,
} from "../_shared/utils.ts";

/**
 * Efeitos colaterais de acoes administrativas que JA foram aplicadas e auditadas
 * pelas RPCs do banco (admin_ban_user, admin_unban_user, admin_set_access_level):
 *   - aplica/retira o banimento no Supabase Auth (bloqueia login e refresh);
 *   - envia o e-mail de aviso ao usuario afetado.
 * Nada aqui confia no cliente: o estado real e relido do banco antes de agir.
 */
const ALLOWED_ACTIONS = ["user_banned", "user_unbanned", "access_level_changed"] as const;
type Action = typeof ALLOWED_ACTIONS[number];
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "LevelUp Exams <onboarding@resend.dev>";

const LEVEL_LABELS: Record<string, string> = {
  admin: "Administrador",
  moderator: "Moderador",
  user: "Usuário",
};

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

    const auth = await requireStaff(supabase, req);
    if ("error" in auth) return auth.error;
    const actor = auth.user;

    const rl = await checkRateLimit(supabase, `user:${actor.id}`, "admin-notify", 60000, 30);
    if (!rl.allowed) return jsonResponse({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });

    const body = await readJson<Record<string, unknown>>(req, 8 * 1024);
    const action = body?.action as Action;
    const targetUserId = body?.targetUserId;
    if (!body || !ALLOWED_ACTIONS.includes(action)) return jsonResponse({ error: "Invalid action type" }, 400);
    if (typeof targetUserId !== "string" || !UUID_RE.test(targetUserId)) {
      return jsonResponse({ error: "Invalid target" }, 400);
    }

    // Mesma hierarquia das RPCs: niveis de acesso so o master; moderacao respeita _can_moderate.
    if (action === "access_level_changed") {
      if (auth.level !== "master") return jsonResponse({ error: "Acesso negado" }, 403);
    } else {
      const { data: allowed } = await supabase.rpc("_can_moderate", { p_actor: actor.id, p_target: targetUserId });
      if (allowed !== true) return jsonResponse({ error: "Acesso negado" }, 403);
    }

    const rawDetails = (body.details && typeof body.details === "object") ? body.details as Record<string, unknown> : {};
    const reason = clip(rawDetails.reason, 500);
    const targetName = clip(body.targetName, 100);

    const { data: targetUser } = await supabase.auth.admin.getUserById(targetUserId);
    if (!targetUser?.user) return jsonResponse({ error: "Usuário não encontrado" }, 404);
    const targetEmail = targetUser.user.email;

    let subject = "";
    let htmlBody = "";
    const safeName = escapeHtml(targetName || "");
    const safeReason = escapeHtml(reason);

    if (action === "user_banned") {
      // Le o banimento real gravado pela RPC (tipo e expiracao nao vem do cliente).
      const { data: ban } = await supabase
        .from("user_bans")
        .select("ban_type, expires_at")
        .eq("user_id", targetUserId)
        .eq("is_active", true)
        .order("banned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const stillActive = ban && (!ban.expires_at || new Date(ban.expires_at).getTime() > Date.now());
      if (!stillActive) return jsonResponse({ error: "Nenhum banimento ativo registrado" }, 409);

      const permanent = ban.ban_type === "permanent";
      const hours = permanent
        ? 36500 * 24
        : Math.max(1, Math.ceil((new Date(ban.expires_at as string).getTime() - Date.now()) / 3_600_000));
      // Com ban_duration o GoTrue recusa login e refresh; o access token atual expira
      // naturalmente e as Edge Functions ja recusam usuarios banidos (requireUser).
      await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: `${hours}h` });

      const days = Math.max(1, Math.round(hours / 24));
      subject = "Sua conta foi suspensa - LevelUp Exams";
      htmlBody = `<h2>Sua conta foi suspensa</h2><p>Olá ${safeName},</p><p>Informamos que sua conta no LevelUp Exams foi <strong>${permanent ? "banida permanentemente" : `suspensa temporariamente por ${days} dia(s)`}</strong>.</p>${safeReason ? `<p><strong>Motivo:</strong> ${safeReason}</p>` : ""}<p>Se você acredita que houve um engano, entre em contato com o suporte.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
    } else if (action === "user_unbanned") {
      const { data: stillBanned } = await supabase.rpc("is_user_banned", { p_user_id: targetUserId });
      if (stillBanned === true) return jsonResponse({ error: "O usuário ainda possui banimento ativo" }, 409);
      await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: "none" });
      subject = "Sua conta foi reativada - LevelUp Exams";
      htmlBody = `<h2>Sua conta foi reativada</h2><p>Olá ${safeName},</p><p>Informamos que sua conta no LevelUp Exams foi <strong>reativada</strong>. Você já pode acessar a plataforma normalmente.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
    } else if (action === "access_level_changed") {
      // O nivel informado no e-mail e o nivel atual do banco, nunca o enviado pelo cliente.
      const level = await getAccessLevel(supabase, targetUserId);
      const label = escapeHtml(LEVEL_LABELS[level] ?? "Usuário");
      subject = "Seu nível de acesso foi atualizado - LevelUp Exams";
      htmlBody = level === "user"
        ? `<h2>Nível de acesso atualizado</h2><p>Olá ${safeName},</p><p>As permissões administrativas da sua conta no LevelUp Exams foram <strong>removidas</strong>. Você continua com acesso normal à plataforma.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`
        : `<h2>Nível de acesso atualizado</h2><p>Olá ${safeName},</p><p>Sua conta no LevelUp Exams agora tem o nível de acesso <strong>${label}</strong>.</p><p>Atenciosamente,<br/>Equipe LevelUp Exams</p>`;
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && targetEmail && subject && htmlBody) {
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

    return jsonResponse({ success: true });
  } catch {
    console.error("admin-notify error");
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});

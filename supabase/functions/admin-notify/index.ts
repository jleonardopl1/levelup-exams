import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/utils.ts";

const ALLOWED_ACTIONS = ["user_banned", "user_unbanned", "role_assigned", "role_revoked"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const body = await req.json();
    const { action, targetUserId, targetName, details } = body;

    // Validate action type
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get target user email
    const { data: targetUser } = await supabaseClient.auth.admin.getUserById(targetUserId);
    const targetEmail = targetUser?.user?.email;

    // Log audit event
    await supabaseClient.from("audit_logs").insert({
      user_id: userData.user.id,
      user_email: userData.user.email,
      event_type: action,
      success: true,
      metadata: {
        target_user_id: targetUserId,
        target_name: targetName,
        ...details,
      },
    });

    // Send email notification via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && targetEmail) {
      const safeName = escapeHtml(targetName || "");
      const safeReason = details?.reason ? escapeHtml(details.reason) : "";
      const safeRole = details?.role ? escapeHtml(details.role) : "";
      const safeBanDays = details?.ban_days ? escapeHtml(String(details.ban_days)) : "alguns";
      const safeBanType = details?.ban_type ? escapeHtml(details.ban_type) : "";

      let subject = "";
      let htmlBody = "";

      switch (action) {
        case "user_banned":
          subject = "Sua conta foi suspensa - LevelUp Exams";
          htmlBody = `
            <h2>Sua conta foi suspensa</h2>
            <p>Olá ${safeName},</p>
            <p>Informamos que sua conta no LevelUp Exams foi <strong>${safeBanType === 'permanent' ? 'banida permanentemente' : `suspensa temporariamente por ${safeBanDays} dias`}</strong>.</p>
            ${safeReason ? `<p><strong>Motivo:</strong> ${safeReason}</p>` : ''}
            <p>Se você acredita que houve um engano, entre em contato com o suporte.</p>
            <p>Atenciosamente,<br/>Equipe LevelUp Exams</p>
          `;
          break;
        case "user_unbanned":
          subject = "Sua conta foi reativada - LevelUp Exams";
          htmlBody = `
            <h2>Sua conta foi reativada</h2>
            <p>Olá ${safeName},</p>
            <p>Informamos que sua conta no LevelUp Exams foi <strong>reativada</strong>. Você já pode acessar a plataforma normalmente.</p>
            <p>Atenciosamente,<br/>Equipe LevelUp Exams</p>
          `;
          break;
        case "role_assigned":
          subject = "Nova permissão atribuída - LevelUp Exams";
          htmlBody = `
            <h2>Nova permissão atribuída</h2>
            <p>Olá ${safeName},</p>
            <p>Você recebeu a permissão de <strong>${safeRole}</strong> no LevelUp Exams.</p>
            <p>Atenciosamente,<br/>Equipe LevelUp Exams</p>
          `;
          break;
        case "role_revoked":
          subject = "Permissão removida - LevelUp Exams";
          htmlBody = `
            <h2>Permissão removida</h2>
            <p>Olá ${safeName},</p>
            <p>A permissão de <strong>${safeRole}</strong> foi removida da sua conta no LevelUp Exams.</p>
            <p>Atenciosamente,<br/>Equipe LevelUp Exams</p>
          `;
          break;
      }

      if (subject && htmlBody) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "LevelUp Exams <onboarding@resend.dev>",
              to: [targetEmail],
              subject,
              html: htmlBody,
            }),
          });
        } catch (emailErr) {
          console.error("Email send error:", emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: msg.includes("Forbidden") ? 403 : 500,
    });
  }
});

export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Clean up old entries first
  await supabase
    .from("rate_limits")
    .delete()
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .lt("window_start", windowStart);

  // Use upsert with atomic increment via raw SQL-like approach
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, request_count")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart)
    .maybeSingle();

  if (existing) {
    if (existing.request_count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    await supabase
      .from("rate_limits")
      .update({
        request_count: existing.request_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return {
      allowed: true,
      remaining: maxRequests - existing.request_count - 1,
    };
  }

  await supabase.from("rate_limits").upsert(
    {
      identifier,
      endpoint,
      request_count: 1,
      window_start: new Date().toISOString(),
    },
    { onConflict: "identifier,endpoint" }
  );
  return { allowed: true, remaining: maxRequests - 1 };
}

export async function logAuditEvent(
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
      metadata,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

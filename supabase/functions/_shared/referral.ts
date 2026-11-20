// Código de indicação validado no servidor. Mesmas regras para a Stripe (create-checkout) e
// o Mercado Pago (mp-create-checkout); a comissão só é registrada com o pagamento confirmado.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const REFERRAL_CODE_RE = /^[A-Z0-9]{4,20}$/;

/**
 * Valida o codigo de indicacao no servidor. Regras:
 *  - codigo ativo e nao removido;
 *  - nao e o codigo do proprio comprador;
 *  - o comprador ainda nao usou nenhum codigo (1 indicacao por usuario).
 */
export async function resolveReferral(
  supabase: SupabaseClient,
  rawCode: unknown,
  userId: string,
): Promise<{ id: string; discount: number } | { error: string } | null> {
  if (rawCode === undefined || rawCode === null || rawCode === "") return null;
  if (typeof rawCode !== "string") return { error: "Código de indicação inválido" };
  const code = rawCode.trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return { error: "Código de indicação inválido" };

  const { data: ref } = await supabase
    .from("referral_codes")
    .select("id, user_id, discount_percent, is_active, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (!ref || !ref.is_active || ref.revoked_at) return { error: "Código de indicação inválido ou inativo" };
  if (ref.user_id === userId) return { error: "Você não pode usar o seu próprio código de indicação" };

  const { count } = await supabase
    .from("referral_uses")
    .select("id", { count: "exact", head: true })
    .eq("referred_user_id", userId);
  if ((count ?? 0) > 0) return { error: "Você já utilizou um código de indicação" };

  return { id: ref.id as string, discount: Number(ref.discount_percent) || 0 };
}

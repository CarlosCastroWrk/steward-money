import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const env = process.env.PLAID_ENV ?? "sandbox";

  const [itemsRes, accountsRes, txCountRes, lastSyncedRes] = await Promise.all([
    supabase.from("plaid_items").select("id, institution_name, created_at").eq("user_id", user.id),
    supabase.from("accounts").select("id, name, type, last_synced").eq("user_id", user.id).not("plaid_account_id", "is", null),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_manual", false).gte("date", new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0]),
    supabase.from("accounts").select("last_synced").eq("user_id", user.id).not("last_synced", "is", null).order("last_synced", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json({
    plaid_env: env,
    is_sandbox: env === "sandbox",
    connected_items: itemsRes.data?.length ?? 0,
    institutions: (itemsRes.data ?? []).map((i) => i.institution_name).filter(Boolean),
    connected_accounts: accountsRes.data?.length ?? 0,
    accounts: (accountsRes.data ?? []).map((a) => ({ name: a.name, type: a.type })),
    last_synced: lastSyncedRes.data?.last_synced ?? null,
    transactions_last_30d: txCountRes.count ?? 0,
  });
}

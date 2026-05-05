import { Metadata } from "next";
export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "@/components/transactions/TransactionsView";

export default async function TransactionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [txRes, accountsRes, plaidItemsRes, lastSyncedRes] = await Promise.all([
    supabase.from("transactions").select("id, user_id, account_id, date, merchant, amount, category, is_need, is_recurring, is_pending, notes, is_manual, plaid_transaction_id, created_at").eq("user_id", user.id).order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("accounts").select("id, name, type").eq("user_id", user.id).eq("is_active", true),
    supabase.from("plaid_items").select("id").eq("user_id", user.id).limit(1),
    supabase.from("accounts").select("last_synced").eq("user_id", user.id).not("last_synced", "is", null).order("last_synced", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const plaidConnected = (plaidItemsRes.data?.length ?? 0) > 0;
  const lastSynced = lastSyncedRes.data?.last_synced ?? null;

  // Get connected institution name
  let institutionName = "your bank";
  if (plaidConnected) {
    const { data: acct } = await supabase.from("accounts").select("institution").eq("user_id", user.id).not("plaid_account_id", "is", null).limit(1).maybeSingle();
    if (acct?.institution) institutionName = acct.institution;
  }

  return (
    <TransactionsView
      transactions={txRes.data ?? []}
      accounts={accountsRes.data ?? []}
      plaidConnected={plaidConnected}
      institutionName={institutionName}
      serverLastSynced={lastSynced}
    />
  );
}

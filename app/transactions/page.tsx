import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "@/components/transactions/TransactionsView";

export default async function TransactionsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [txRes, accountsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, user_id, account_id, date, merchant, amount, category, is_need, is_recurring, is_pending, notes, is_manual, plaid_transaction_id, created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("user_id", user.id)
      .eq("is_active", true)
  ]);

  return (
    <TransactionsView
      transactions={txRes.data ?? []}
      accounts={accountsRes.data ?? []}
    />
  );
}

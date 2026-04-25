import { createClient } from "@/lib/supabase/server";
import { BillsView } from "@/components/bills/BillsView";

export default async function BillsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [billsRes, accountsRes] = await Promise.all([
    supabase
      .from("bills")
      .select("id, user_id, name, amount, due_day, frequency, is_autopay, next_due_date, account_id, notes, created_at")
      .eq("user_id", user.id)
      .order("next_due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("user_id", user.id)
      .eq("is_active", true)
  ]);

  return (
    <BillsView
      bills={billsRes.data ?? []}
      accounts={accountsRes.data ?? []}
    />
  );
}

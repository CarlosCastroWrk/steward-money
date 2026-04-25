import { createClient } from "@/lib/supabase/server";
import { AccountsView } from "@/components/accounts/AccountsView";
import type { Account } from "@/components/accounts/types";

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function computeSummary(accounts: Account[]) {
  let totalCash = 0;
  let totalDebt = 0;
  for (const a of accounts) {
    const b = toNumber(a.current_balance);
    if (a.type === "checking" || a.type === "savings") {
      totalCash += b;
    }
    if (a.type === "credit card" || a.type === "debt / installment") {
      totalDebt += Math.abs(b);
    }
  }
  return { totalCash, totalDebt, net: totalCash - totalDebt };
}

export default async function AccountsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, institution, type, current_balance, is_manual, is_active, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return null;
  }

  const accounts = (data ?? []) as Account[];
  const summary = computeSummary(accounts);

  return <AccountsView accounts={accounts} {...summary} />;
}

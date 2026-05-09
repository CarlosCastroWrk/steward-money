import { Metadata } from "next";
export const metadata: Metadata = { title: "Accounts" };
import { createClient } from "@/lib/supabase/server";
import { AccountsView } from "@/components/accounts/AccountsView";
import type { Account, PlaidItem } from "@/components/accounts/types";

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function computeSummary(accounts: Account[]) {
  let totalCash = 0;
  let totalDebt = 0;
  for (const a of accounts) {
    const isDepository = a.plaid_type ? a.plaid_type === "depository" : ["checking", "savings"].includes(a.type);
    const isCredit     = a.plaid_type ? a.plaid_type === "credit"     : a.type === "credit card";
    const isLoan       = a.plaid_type ? a.plaid_type === "loan"       : a.type === "debt / installment";

    if (isDepository) {
      // Use available cash (not present balance) for liquid total
      totalCash += toNumber(a.available_balance ?? a.current_balance);
    } else if (isCredit || isLoan) {
      // current_balance = amount owed (positive number in Plaid convention)
      totalDebt += Math.abs(toNumber(a.current_balance));
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

  const [{ data, error }, { data: itemData }, { data: lastSyncedData }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, institution, type, plaid_type, plaid_subtype, current_balance, available_balance, credit_limit, is_manual, is_active, created_at, last_synced")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("plaid_items")
      .select("id, item_id, institution_name, institution_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("last_synced")
      .eq("user_id", user.id)
      .not("last_synced", "is", null)
      .order("last_synced", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    return null;
  }

  const accounts = (data ?? []) as Account[];
  const plaidItems = (itemData ?? []) as PlaidItem[];
  const summary = computeSummary(accounts);
  const serverLastSynced = lastSyncedData?.last_synced ?? null;

  return <AccountsView accounts={accounts} plaidItems={plaidItems} serverLastSynced={serverLastSynced} {...summary} />;
}

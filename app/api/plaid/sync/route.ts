import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, access_token")
    .eq("user_id", user.id);

  if (!items?.length) return NextResponse.json({ accounts_updated: 0, transactions_synced: 0 });

  const now = new Date().toISOString();
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: savedAccounts } = await supabase
    .from("accounts")
    .select("id, plaid_account_id")
    .eq("user_id", user.id)
    .not("plaid_account_id", "is", null);

  const accountIdMap = Object.fromEntries(
    (savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id])
  );

  let accountsUpdated = 0;
  let transactionsSynced = 0;

  for (const item of items) {
    try {
      const accountsRes = await plaidClient.accountsGet({ access_token: item.access_token });
      for (const a of accountsRes.data.accounts) {
        await supabase
          .from("accounts")
          .update({ current_balance: a.balances.current ?? 0, last_synced: now })
          .eq("plaid_account_id", a.account_id)
          .eq("user_id", user.id);
        accountsUpdated++;
      }

      const txRes = await plaidClient.transactionsGet({
        access_token: item.access_token,
        start_date: startDate,
        end_date: endDate,
      });

      const txRows = txRes.data.transactions.map((tx) => ({
        user_id: user.id,
        account_id: accountIdMap[tx.account_id] ?? null,
        date: tx.date,
        merchant: tx.merchant_name ?? tx.name,
        amount: -(tx.amount),
        category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
        is_manual: false,
        plaid_transaction_id: tx.transaction_id,
      }));

      if (txRows.length > 0) {
        // ignoreDuplicates so we don't overwrite user-edited fields
        await supabase.from("transactions").upsert(txRows, {
          onConflict: "plaid_transaction_id",
          ignoreDuplicates: true,
        });
        transactionsSynced += txRows.length;
      }
    } catch {
      // Continue if one item fails
    }
  }

  return NextResponse.json({ accounts_updated: accountsUpdated, transactions_synced: transactionsSynced });
}

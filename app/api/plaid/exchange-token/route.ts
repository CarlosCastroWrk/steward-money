import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { public_token, institution_name, institution_id } = await req.json();

  // Exchange public token for access token
  const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
  const accessToken = exchangeRes.data.access_token;
  const itemId = exchangeRes.data.item_id;

  // Save the access token server-side
  await supabase.from("plaid_items").insert({
    user_id: user.id,
    access_token: accessToken,
    item_id: itemId,
    institution_name: institution_name ?? null,
    institution_id: institution_id ?? null,
  });

  // Pull accounts
  const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
  const accounts = accountsRes.data.accounts;

  // Map Plaid account type to our type
  function mapType(type: string, subtype: string | null | undefined): string {
    if (type === "credit") return "credit card";
    if (type === "loan") return "debt / installment";
    if (subtype === "savings") return "savings";
    return "checking";
  }

  const accountRows = accounts.map((a) => ({
    user_id: user.id,
    name: a.name,
    institution: institution_name ?? null,
    type: mapType(a.type, a.subtype),
    current_balance: a.balances.current ?? 0,
    is_manual: false,
    is_active: true,
    plaid_account_id: a.account_id,
  }));

  // Upsert accounts by plaid_account_id to avoid duplicates on re-link
  await supabase.from("accounts").upsert(accountRows, { onConflict: "plaid_account_id" });

  // Fetch account IDs we just upserted
  const { data: savedAccounts } = await supabase
    .from("accounts")
    .select("id, plaid_account_id")
    .eq("user_id", user.id)
    .not("plaid_account_id", "is", null);

  const accountIdMap = Object.fromEntries(
    (savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id])
  );

  // Pull 90 days of transactions
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const txRes = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });

  const txRows = txRes.data.transactions.map((tx) => ({
    user_id: user.id,
    account_id: accountIdMap[tx.account_id] ?? null,
    date: tx.date,
    merchant: tx.merchant_name ?? tx.name,
    // Plaid uses positive = expense, negative = income — we invert
    amount: -tx.amount,
    category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
    is_manual: false,
    plaid_transaction_id: tx.transaction_id,
  }));

  // Upsert by plaid_transaction_id to avoid duplicates
  if (txRows.length > 0) {
    await supabase.from("transactions").upsert(txRows, { onConflict: "plaid_transaction_id" });
  }

  return NextResponse.json({
    accounts_synced: accountRows.length,
    transactions_synced: txRows.length,
  });
}

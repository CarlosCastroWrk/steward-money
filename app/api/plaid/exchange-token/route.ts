import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";

function mapType(type: string, subtype: string | null | undefined): string {
  if (type === "credit") return "credit card";
  if (type === "loan") return "debt / installment";
  if (subtype === "savings") return "savings";
  return "checking";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { public_token, institution_name, institution_id } = await req.json();

    let accessToken: string;
    let itemId: string;
    try {
      const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
      accessToken = exchangeRes.data.access_token;
      itemId = exchangeRes.data.item_id;
    } catch (err: unknown) {
      const plaidErr = err as { response?: { data?: { error_message?: string } } };
      const msg = plaidErr?.response?.data?.error_message ?? "Failed to exchange Plaid token";
      console.error("[exchange-token] itemPublicTokenExchange:", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { error: itemErr } = await supabase.from("plaid_items").insert({
      user_id: user.id,
      access_token: accessToken,
      item_id: itemId,
      institution_name: institution_name ?? null,
      institution_id: institution_id ?? null,
    });
    if (itemErr) console.error("[exchange-token] plaid_items insert:", itemErr.message);

    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = accountsRes.data.accounts;

    const accountRows = accounts.map((a) => ({
      user_id: user.id,
      name: cleanName(a.name),
      institution: institution_name ?? null,
      type: mapType(a.type as string, a.subtype as string | null),
      current_balance: a.balances.current ?? 0,
      is_manual: false,
      is_active: true,
      plaid_account_id: a.account_id,
    }));

    const { error: accErr } = await supabase
      .from("accounts")
      .upsert(accountRows, { onConflict: "plaid_account_id" });
    if (accErr) console.error("[exchange-token] accounts upsert:", accErr.message);

    const { data: savedAccounts } = await supabase
      .from("accounts")
      .select("id, plaid_account_id")
      .eq("user_id", user.id)
      .not("plaid_account_id", "is", null);

    const accountIdMap = Object.fromEntries(
      (savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id])
    );

    let transactionsSynced = 0;
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const txRes = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
      });

      const rawCategory = (tx: typeof txRes.data.transactions[0]) =>
        tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null;

      const txRows = txRes.data.transactions.map((tx) => {
        const cat = rawCategory(tx);
        return {
          user_id: user.id,
          account_id: accountIdMap[tx.account_id] ?? null,
          date: tx.date,
          merchant: cleanName(tx.merchant_name ?? tx.name),
          amount: -(tx.amount),
          category: mapCategory(cat),
          is_need: inferIsNeed(cat),
          is_manual: false,
          plaid_transaction_id: tx.transaction_id,
        };
      });

      if (txRows.length > 0) {
        const { error: txErr } = await supabase
          .from("transactions")
          .upsert(txRows, { onConflict: "plaid_transaction_id" });
        if (txErr) console.error("[exchange-token] transactions upsert:", txErr.message);
        else transactionsSynced = txRows.length;
      }
    } catch (err: unknown) {
      const plaidErr = err as { response?: { data?: { error_code?: string; error_message?: string } } };
      if (plaidErr?.response?.data?.error_code !== "PRODUCT_NOT_READY") {
        console.error("[exchange-token] transactionsGet:", plaidErr?.response?.data?.error_message ?? err);
      }
    }

    return NextResponse.json({
      accounts_synced: accountRows.length,
      transactions_synced: transactionsSynced,
    });
  } catch (err) {
    console.error("[exchange-token] unexpected:", err);
    return NextResponse.json({ error: "Unexpected error during bank sync" }, { status: 500 });
  }
}

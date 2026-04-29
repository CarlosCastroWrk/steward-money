import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";

const SYNC_CODES = new Set([
  "DEFAULT_UPDATE",
  "SYNC_UPDATES_AVAILABLE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { webhook_type, webhook_code, item_id } = body;

  if (webhook_type !== "TRANSACTIONS" || !SYNC_CODES.has(webhook_code)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, user_id, access_token")
    .eq("item_id", item_id)
    .single();

  if (!item) return NextResponse.json({ ok: true });

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: savedAccounts } = await supabase
    .from("accounts")
    .select("id, plaid_account_id")
    .eq("user_id", item.user_id)
    .not("plaid_account_id", "is", null);

  const accountIdMap = Object.fromEntries(
    (savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id])
  );

  try {
    const txRes = await plaidClient.transactionsGet({
      access_token: item.access_token,
      start_date: startDate,
      end_date: endDate,
    });

    const rawCategory = (tx: typeof txRes.data.transactions[0]) =>
      tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null;

    const txRows = txRes.data.transactions.map((tx) => {
      const cat = rawCategory(tx);
      return {
        user_id: item.user_id,
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
      await supabase.from("transactions").upsert(txRows, {
        onConflict: "plaid_transaction_id",
        ignoreDuplicates: true,
      });
    }
  } catch {
    // Non-fatal — return 200 so Plaid doesn't retry
  }

  return NextResponse.json({ ok: true });
}

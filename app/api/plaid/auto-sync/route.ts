import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";

export async function POST(req: NextRequest) {
  // Only allow Vercel cron invocations
  if (req.headers.get("x-vercel-cron") !== "1") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, user_id, access_token");

  if (!items?.length) return NextResponse.json({ synced: 0 });

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const now = new Date().toISOString();

  let synced = 0;

  for (const item of items) {
    try {
      const { data: savedAccounts } = await supabase
        .from("accounts")
        .select("id, plaid_account_id")
        .eq("user_id", item.user_id)
        .not("plaid_account_id", "is", null);

      const accountIdMap = Object.fromEntries(
        (savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id])
      );

      const accountsRes = await plaidClient.accountsGet({ access_token: item.access_token });
      for (const a of accountsRes.data.accounts) {
        await supabase
          .from("accounts")
          .update({ current_balance: a.balances.current ?? 0, last_synced: now })
          .eq("plaid_account_id", a.account_id)
          .eq("user_id", item.user_id);
      }

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
          is_pending: tx.pending ?? false,
          plaid_transaction_id: tx.transaction_id,
        };
      });

      if (txRows.length > 0) {
        const posted  = txRows.filter((r) => !r.is_pending);
        const pending = txRows.filter((r) => r.is_pending);

        if (posted.length > 0) {
          await supabase.from("transactions").upsert(posted, { onConflict: "plaid_transaction_id", ignoreDuplicates: false });
        }
        if (pending.length > 0) {
          await supabase.from("transactions").upsert(pending, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
        }

        if (posted.length > 0) {
          const { data: stalePending } = await supabase
            .from("transactions")
            .select("id, amount, date")
            .eq("user_id", item.user_id)
            .eq("is_pending", true)
            .eq("is_manual", false);

          if (stalePending?.length) {
            const toDelete: string[] = [];
            for (const p of posted) {
              const match = stalePending.find((s) =>
                !toDelete.includes(s.id) &&
                Math.abs(Number(s.amount) - p.amount) < 0.02 &&
                s.date === p.date
              );
              if (match) toDelete.push(match.id);
            }
            if (toDelete.length) {
              await supabase.from("transactions").delete().in("id", toDelete);
            }
          }
        }
      }

      synced++;
    } catch {
      // continue if one item fails
    }
  }

  return NextResponse.json({ synced });
}

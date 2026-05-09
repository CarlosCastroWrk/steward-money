import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-vercel-cron") !== "1") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, user_id, access_token, plaid_cursor");

  if (!items?.length) return NextResponse.json({ synced: 0 });

  let synced = 0;

  for (const item of items) {
    try {
      const { data: savedAccounts } = await supabase
        .from("accounts")
        .select("id, plaid_account_id")
        .eq("user_id", item.user_id)
        .not("plaid_account_id", "is", null);

      const accountIdMap = Object.fromEntries(
        (savedAccounts ?? []).map((a: { plaid_account_id: string; id: string }) => [a.plaid_account_id, a.id])
      );

      // Live balance fetch (not cached)
      const accountsRes = await plaidClient.accountsBalanceGet({ access_token: item.access_token });
      for (const a of accountsRes.data.accounts) {
        const isDepository = a.type === "depository";
        const isCredit     = a.type === "credit";
        const isLoan       = a.type === "loan";
        await supabase
          .from("accounts")
          .update({
            plaid_type: a.type as string,
            plaid_subtype: (a.subtype ?? null) as string | null,
            current_balance: a.balances.current ?? 0,
            available_balance: isDepository ? (a.balances.available ?? a.balances.current ?? 0) : null,
            credit_limit: (isCredit || isLoan) ? (a.balances.limit ?? null) : null,
            last_synced: now,
          })
          .eq("plaid_account_id", a.account_id)
          .eq("user_id", item.user_id);
      }

      // Cursor-based incremental transaction sync
      let cursor: string | undefined = item.plaid_cursor ?? undefined;
      let hasMore = true;

      while (hasMore) {
        const txRes = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 500,
        });

        const { added, modified, removed, next_cursor, has_more } = txRes.data;
        hasMore = has_more;

        const toUpsert = [...added, ...modified].map((tx) => {
          const cat = tx.personal_finance_category?.primary ?? (tx.category?.[0] ?? null);
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

        if (toUpsert.length > 0) {
          const posted  = toUpsert.filter((r) => !r.is_pending);
          const pending = toUpsert.filter((r) => r.is_pending);

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
                const match = stalePending.find((s: { id: string; amount: number; date: string }) =>
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

        if (removed.length > 0) {
          const removedIds = removed.map((r) => r.transaction_id);
          await supabase
            .from("transactions")
            .delete()
            .in("plaid_transaction_id", removedIds)
            .eq("user_id", item.user_id);
        }

        cursor = next_cursor;
      }

      await supabase
        .from("plaid_items")
        .update({ plaid_cursor: cursor })
        .eq("id", item.id);

      synced++;
    } catch {
      // continue if one item fails
    }
  }

  return NextResponse.json({ synced });
}

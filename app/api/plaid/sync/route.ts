import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";
import { notify } from "@/lib/notifications";

async function autoDetectBillPayments(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  newTransactions: { merchant: string; amount: number; date: string }[]
) {
  const { data: bills } = await supabase
    .from("bills")
    .select("id, name, amount")
    .eq("user_id", userId)
    .is("paid_at", null);

  if (!bills?.length) return;

  for (const tx of newTransactions) {
    if (tx.amount >= 0) continue; // only expenses
    const txMerchant = tx.merchant.toLowerCase().trim();
    for (const bill of bills) {
      const billName = bill.name.toLowerCase().trim();
      const amtMatch = Math.abs(Math.abs(tx.amount) - Number(bill.amount)) < Number(bill.amount) * 0.1;
      const nameMatch = txMerchant.includes(billName) || billName.includes(txMerchant) ||
        txMerchant.split(" ").some((w) => w.length > 3 && billName.includes(w));
      if (nameMatch && amtMatch) {
        await supabase.from("bills").update({
          paid_at: new Date().toISOString(),
          auto_detected_paid: true,
        }).eq("id", bill.id).eq("user_id", userId);
        break;
      }
    }
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, access_token, plaid_cursor")
    .eq("user_id", user.id);
  if (!items?.length) return NextResponse.json({ accounts_updated: 0, transactions_synced: 0 });

  const now = new Date().toISOString();
  const body = await req.text().catch(() => "");
  let parsedBody: Record<string, unknown> = {};
  try { parsedBody = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
  const resetCursors = parsedBody.reset_cursors === true;

  const { data: savedAccounts } = await supabase.from("accounts").select("id, plaid_account_id").eq("user_id", user.id).not("plaid_account_id", "is", null);
  const accountIdMap = Object.fromEntries((savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id]));

  let accountsUpdated = 0;
  let transactionsSynced = 0;
  const allNewTx: { merchant: string; amount: number; date: string }[] = [];
  const itemErrors: { institution: string; code: string; message: string }[] = [];

  for (const item of items) {
    try {
      // accountsBalanceGet forces a live fetch from the bank (not Plaid cache).
      // accountsGet returns cached data — do not use for balance accuracy.
      const accountsRes = await plaidClient.accountsBalanceGet({ access_token: item.access_token });
      for (const a of accountsRes.data.accounts) {
        const isDepository = a.type === "depository";
        const isCredit     = a.type === "credit";
        const isLoan       = a.type === "loan";
        const payload = {
          name: cleanName(a.name),
          plaid_type: a.type as string,
          plaid_subtype: (a.subtype ?? null) as string | null,
          current_balance: a.balances.current ?? 0,
          available_balance: isDepository ? (a.balances.available ?? a.balances.current ?? 0) : null,
          credit_limit: (isCredit || isLoan) ? (a.balances.limit ?? null) : null,
          last_synced: now,
        };
        console.log(`[sync] updating account ${a.account_id} (${a.name}): current=${a.balances.current} available=${a.balances.available}`);
        const { error: updateErr } = await supabase.from("accounts").update(payload).eq("plaid_account_id", a.account_id).eq("user_id", user.id);
        if (updateErr) {
          console.error(`[sync] account update failed for ${a.account_id}: ${updateErr.message}`);
        } else {
          accountsUpdated++;
        }
      }

      // cursor-based incremental sync — only fetches transactions new since last sync
      let cursor: string | undefined = resetCursors ? undefined : (item.plaid_cursor ?? undefined);
      console.log(`[sync] item ${item.id} — starting cursor: ${cursor ?? "(none, full refresh)"}`);

      let addedCount = 0;
      let modifiedCount = 0;
      let removedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const txRes = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 500,
        });

        const { added, modified, removed, next_cursor, has_more } = txRes.data;
        hasMore = has_more;

        console.log(`[sync] item ${item.id} — batch: added=${added.length} modified=${modified.length} removed=${removed.length} has_more=${has_more}`);

        const toUpsert = [...added, ...modified].map((tx) => {
          const cat = tx.personal_finance_category?.primary ?? (tx.category?.[0] ?? null);
          return {
            user_id: user.id,
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
            const { error: upsertErr } = await supabase
              .from("transactions")
              .upsert(posted, { onConflict: "plaid_transaction_id", ignoreDuplicates: false });
            if (upsertErr) console.error(`[sync] upsert posted failed: ${upsertErr.message}`);
          }
          if (pending.length > 0) {
            const { error: upsertErr } = await supabase
              .from("transactions")
              .upsert(pending, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
            if (upsertErr) console.error(`[sync] upsert pending failed: ${upsertErr.message}`);
          }

          // Remove stale pending rows when posted transactions settle with a new plaid_transaction_id.
          // Plaid issues a new transaction_id on settlement — match by amount + date to find orphaned pending rows.
          if (posted.length > 0) {
            const { data: stalePending } = await supabase
              .from("transactions")
              .select("id, amount, date")
              .eq("user_id", user.id)
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
              if (toDelete.length > 0) {
                await supabase.from("transactions").delete().in("id", toDelete);
                console.log(`[sync] removed ${toDelete.length} stale pending rows`);
              }
            }
          }

          addedCount += added.length;
          modifiedCount += modified.length;
          allNewTx.push(...posted.filter((t) => added.some((a) => a.transaction_id === t.plaid_transaction_id)).map((t) => ({ merchant: t.merchant, amount: t.amount, date: t.date })));
        }

        // Delete transactions Plaid says were removed
        if (removed.length > 0) {
          const removedIds = removed.map((r) => r.transaction_id);
          const { error: delErr } = await supabase
            .from("transactions")
            .delete()
            .in("plaid_transaction_id", removedIds)
            .eq("user_id", user.id);
          if (delErr) console.error(`[sync] delete removed failed: ${delErr.message}`);
          removedCount += removed.length;
        }

        cursor = next_cursor;
      }

      // Persist the final cursor so next sync only fetches truly new data
      const { error: cursorErr } = await supabase
        .from("plaid_items")
        .update({ plaid_cursor: cursor })
        .eq("id", item.id)
        .eq("user_id", user.id);
      if (cursorErr) console.error(`[sync] cursor save failed: ${cursorErr.message}`);

      console.log(`[sync] item ${item.id} done — added=${addedCount} modified=${modifiedCount} removed=${removedCount} next_cursor=${cursor?.slice(0, 20)}…`);
      transactionsSynced += addedCount + modifiedCount;

    } catch (err: unknown) {
      const plaidErr = err as { response?: { data?: { error_code?: string; error_message?: string } } };
      const code = plaidErr?.response?.data?.error_code ?? "UNKNOWN";
      const msg  = plaidErr?.response?.data?.error_message ?? String(err);
      console.error(`[sync] item ${item.id} failed: ${code} — ${msg}`);
      const { data: itemRow } = await supabase.from("plaid_items").select("institution_name").eq("id", item.id).maybeSingle();
      itemErrors.push({ institution: itemRow?.institution_name ?? item.id, code, message: msg });
      if (code !== "PRODUCT_NOT_READY") {
        await notify(supabase, user.id, {
          type: `plaid_sync_error_${item.id}`,
          message: `Bank sync failed for ${itemRow?.institution_name ?? "your bank"} — ${code === "ITEM_LOGIN_REQUIRED" ? "reconnection required. Go to Accounts." : "we'll retry automatically."}`,
          severity: code === "ITEM_LOGIN_REQUIRED" ? "danger" : "warning",
          agent: "system",
          dedupWindowHours: 6,
        });
      }
    }
  }

  // Auto-detect bill payments from new transactions
  if (allNewTx.length > 0) {
    await autoDetectBillPayments(supabase, user.id, allNewTx);
  }

  // Paycheck detection: flag large income deposits (>$200) for Argus
  const largeDeposits = allNewTx.filter((tx) => tx.amount > 200);
  for (const deposit of largeDeposits) {
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(deposit.amount);
    const alertKey = `income_detected_${deposit.date}`;
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("user_id", user.id)
      .eq("alert_type", alertKey)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.from("alerts").insert({
        user_id: user.id,
        agent: "argus",
        alert_type: alertKey,
        severity: "info",
        message: `New income detected — ${fmt} from ${deposit.merchant}. Tap to review your allocation.`,
        is_read: false,
      });
    }
  }

  return NextResponse.json({
    accounts_updated: accountsUpdated,
    transactions_synced: transactionsSynced,
    ...(itemErrors.length > 0 && { item_errors: itemErrors }),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";

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

  const { data: items } = await supabase.from("plaid_items").select("id, access_token").eq("user_id", user.id);
  if (!items?.length) return NextResponse.json({ accounts_updated: 0, transactions_synced: 0 });

  const now = new Date().toISOString();
  const body = await req.text().catch(() => "");
  let parsedBody: Record<string, unknown> = {};
  try { parsedBody = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
  const deep = parsedBody.deep === true;

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - (deep ? 90 : 30) * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: savedAccounts } = await supabase.from("accounts").select("id, plaid_account_id").eq("user_id", user.id).not("plaid_account_id", "is", null);
  const accountIdMap = Object.fromEntries((savedAccounts ?? []).map((a) => [a.plaid_account_id, a.id]));

  let accountsUpdated = 0;
  let transactionsSynced = 0;
  const allNewTx: { merchant: string; amount: number; date: string }[] = [];
  const itemErrors: { institution: string; code: string; message: string }[] = [];

  for (const item of items) {
    try {
      const accountsRes = await plaidClient.accountsGet({ access_token: item.access_token });
      for (const a of accountsRes.data.accounts) {
        const isDepository = a.type === "depository";
        const isCredit     = a.type === "credit";
        const isLoan       = a.type === "loan";
        await supabase.from("accounts").update({
          name: cleanName(a.name),
          plaid_type: a.type as string,
          plaid_subtype: (a.subtype ?? null) as string | null,
          current_balance: a.balances.current ?? 0,
          available_balance: isDepository ? (a.balances.available ?? a.balances.current ?? 0) : null,
          credit_limit: (isCredit || isLoan) ? (a.balances.limit ?? null) : null,
          last_synced: now,
        }).eq("plaid_account_id", a.account_id).eq("user_id", user.id);
        accountsUpdated++;
      }

      const txRes = await plaidClient.transactionsGet({ access_token: item.access_token, start_date: startDate, end_date: endDate });
      const rawCategory = (tx: typeof txRes.data.transactions[0]) => tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null;

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
          is_pending: tx.pending ?? false,
          plaid_transaction_id: tx.transaction_id,
        };
      });

      if (txRows.length > 0) {
        // Upsert posted transactions; for pending ones use ignoreDuplicates so
        // a newly-settled tx doesn't get blocked by a stale pending row.
        const posted  = txRows.filter((r) => !r.is_pending);
        const pending = txRows.filter((r) => r.is_pending);

        if (posted.length > 0) {
          await supabase.from("transactions").upsert(posted, { onConflict: "plaid_transaction_id", ignoreDuplicates: false });
        }
        if (pending.length > 0) {
          await supabase.from("transactions").upsert(pending, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
        }

        // When a pending tx settles, Plaid issues a new transaction_id.
        // Remove any pending rows that match a now-posted tx by amount + date.
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
            }
          }
        }

        transactionsSynced += txRows.length;
        allNewTx.push(...posted.map((t) => ({ merchant: t.merchant, amount: t.amount, date: t.date })));
      }
    } catch (err: unknown) {
      const plaidErr = err as { response?: { data?: { error_code?: string; error_message?: string } } };
      const code = plaidErr?.response?.data?.error_code ?? "UNKNOWN";
      const msg  = plaidErr?.response?.data?.error_message ?? String(err);
      console.error(`[sync] item ${item.id} failed: ${code} — ${msg}`);
      // Look up institution name for the error report
      const { data: itemRow } = await supabase.from("plaid_items").select("institution_name").eq("id", item.id).maybeSingle();
      itemErrors.push({ institution: itemRow?.institution_name ?? item.id, code, message: msg });
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
    // Deduplicate within 24h by alert_type key
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
    large_deposits: largeDeposits.length,
    ...(itemErrors.length > 0 && { item_errors: itemErrors }),
  });
}

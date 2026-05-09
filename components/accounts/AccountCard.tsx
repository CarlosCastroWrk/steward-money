"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBankColor } from "@/lib/bank-colors";
import type { Account } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function typeBadgeClasses(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "checking") return "bg-blue-950 text-blue-300";
  if (normalized === "savings") return "bg-green-950 text-green-300";
  if (normalized === "credit card") return "bg-red-950 text-red-300";
  if (normalized === "cash" || normalized === "apple cash") return "bg-[var(--bg-elevated)] text-[var(--text-2)]";
  if (normalized === "trading") return "bg-blue-950 text-blue-300";
  if (normalized === "debt / installment") return "bg-orange-950 text-orange-300";
  return "bg-[var(--bg-elevated)] text-[var(--text-2)]";
}

export function AccountCard({ account }: { account: Account }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCreditOrLoan = account.plaid_type === "credit" || account.plaid_type === "loan"
    || account.type === "credit card" || account.type === "debt / installment";

  const presentBalance   = Number(account.current_balance ?? 0);
  const availableBalance = !isCreditOrLoan && account.available_balance != null
    ? Number(account.available_balance)
    : presentBalance;
  const pendingImpact  = presentBalance - availableBalance;
  const hasPendingDiff = !isCreditOrLoan && Math.abs(pendingImpact) >= 0.01;
  const creditLimit    = account.credit_limit != null ? Number(account.credit_limit) : null;
  const availableCredit = creditLimit != null ? creditLimit - presentBalance : null;
  // Primary display number
  const balanceNum = isCreditOrLoan ? presentBalance : availableBalance;

  useEffect(() => {
    if (!editing) {
      setBalanceInput(String(account.current_balance ?? 0));
    }
  }, [account.current_balance, editing]);

  const startEdit = () => {
    setBalanceInput(String(account.current_balance ?? 0));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setBalanceInput(String(account.current_balance ?? 0));
  };

  const saveBalance = async () => {
    const next = Number(balanceInput);
    if (Number.isNaN(next)) return;
    setBusy(true);
    const supabase = createClient();
    const update = isCreditOrLoan
      ? { current_balance: next }
      : { current_balance: next, available_balance: next };
    const { error } = await supabase.from("accounts").update(update).eq("id", account.id);
    setBusy(false);
    if (error) return;
    setEditing(false);
    setSavedFlash(true);
    router.refresh();
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const deactivate = async () => {
    if (!window.confirm("Deactivate this account? It will be removed from your active list.")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", account.id);
    setBusy(false);
    if (error) return;
    router.refresh();
  };

  const { lastSyncedLabel, isStale } = (() => {
    if (!account.last_synced) return { lastSyncedLabel: null, isStale: false };
    const secs = Math.floor((Date.now() - new Date(account.last_synced).getTime()) / 1000);
    if (secs < 60) return { lastSyncedLabel: "Updated just now", isStale: false };
    if (secs < 3600) return { lastSyncedLabel: `Updated ${Math.floor(secs / 60)}m ago`, isStale: false };
    if (secs < 86400) return { lastSyncedLabel: `Updated ${Math.floor(secs / 3600)}h ago`, isStale: secs > 7200 };
    return { lastSyncedLabel: `Updated ${Math.floor(secs / 86400)}d ago`, isStale: true };
  })();

  const bankColor = getBankColor(account.institution);

  return (
    <div
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden"
      style={{ borderLeft: `4px solid ${bankColor}` }}
    >
      <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {account.institution ? (
            <p className="text-xs font-semibold" style={{ color: bankColor }}>{account.institution}</p>
          ) : null}
          <p className="text-base font-medium text-[var(--text-1)]">{account.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${typeBadgeClasses(account.type)}`}>{account.type}</span>
            {account.is_manual ? (
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-3)]">Manual</span>
            ) : null}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <input
            type="number" inputMode="decimal"
            step="any"
            className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-1)]"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveBalance}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-2)] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            {isCreditOrLoan ? (
              /* Credit / loan — show owed + utilization bar */
              <>
                <p className="text-2xl font-semibold text-red-400">{formatCurrency(balanceNum)}</p>
                <p className="mt-0.5 text-xs text-[var(--text-3)]">Owed</p>
                {creditLimit != null && (() => {
                  const utilPct = Math.min(100, Math.round((balanceNum / creditLimit) * 100));
                  const barColor = utilPct > 70 ? "bg-red-500" : utilPct > 30 ? "bg-amber-400" : "bg-emerald-500";
                  return (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-3)]">Utilization</span>
                        <span className={utilPct > 70 ? "text-red-400" : utilPct > 30 ? "text-amber-400" : "text-emerald-400"}>{utilPct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
                        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${utilPct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-[var(--text-3)]">Limit {formatCurrency(creditLimit)}</span>
                        {availableCredit != null && <span className="text-[var(--text-2)]">{formatCurrency(availableCredit)} available</span>}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Depository — show available cash */
              <>
                <p className={`text-2xl font-semibold ${balanceNum < 0 ? "text-red-400" : "text-[var(--text-1)]"}`}>
                  {formatCurrency(balanceNum)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-3)]">Available</p>
                {hasPendingDiff && (
                  <div className="mt-2 space-y-0.5 border-t border-[var(--border-subtle)] pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-3)]">Present balance</span>
                      <span className="text-[var(--text-2)]">{formatCurrency(presentBalance)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-3)]">Pending charges</span>
                      <span className="text-amber-400">−{formatCurrency(Math.abs(pendingImpact))}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {lastSyncedLabel ? (
            <p className={`mt-2 text-xs ${isStale ? "text-amber-400" : "text-[var(--text-3)]"}`}>{lastSyncedLabel}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startEdit}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-2)] disabled:opacity-50"
            >
              Edit balance
            </button>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-2)] disabled:opacity-50"
            >
              Deactivate
            </button>
            {savedFlash ? <span className="self-center text-sm text-emerald-400">Saved</span> : null}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

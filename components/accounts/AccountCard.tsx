"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function typeBadgeClasses(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "checking") return "bg-blue-950 text-blue-300";
  if (normalized === "savings") return "bg-green-950 text-green-300";
  if (normalized === "credit card") return "bg-red-950 text-red-300";
  if (normalized === "cash" || normalized === "apple cash") return "bg-zinc-800 text-zinc-300";
  if (normalized === "trading") return "bg-purple-950 text-purple-300";
  if (normalized === "debt / installment") return "bg-orange-950 text-orange-300";
  return "bg-zinc-800 text-zinc-300";
}

export function AccountCard({ account }: { account: Account }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const balanceNum = Number(account.current_balance ?? 0);

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
    const { error } = await supabase.from("accounts").update({ current_balance: next }).eq("id", account.id);
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

  const lastSyncedLabel = account.last_synced
    ? new Date(account.last_synced).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-medium text-white">{account.name}</p>
          {account.institution ? <p className="text-sm text-zinc-400">{account.institution}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs ${typeBadgeClasses(account.type)}`}>{account.type}</span>
            {account.is_manual ? (
              <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500">Manual</span>
            ) : null}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <input
            type="number"
            step="any"
            className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveBalance}
              disabled={busy}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`mt-4 text-2xl font-semibold ${balanceNum < 0 ? "text-red-400" : "text-white"}`}>
            {formatCurrency(balanceNum)}
          </p>
          {lastSyncedLabel ? <p className="mt-2 text-xs text-zinc-500">Last synced {lastSyncedLabel}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startEdit}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
            >
              Edit balance
            </button>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
            >
              Deactivate
            </button>
            {savedFlash ? <span className="self-center text-sm text-green-400">Saved</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

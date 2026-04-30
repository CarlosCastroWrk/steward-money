"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AddTransactionModal } from "./AddTransactionModal";
import { CATEGORIES } from "./types";
import type { Transaction, AccountOption } from "./types";

type Props = { transactions: Transaction[]; accounts: AccountOption[] };

const AVATAR_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500",
  "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500",
  "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-pink-500",
];

function merchantAvatar(name: string | null) {
  const clean = (name ?? "?").trim();
  const hash = clean.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    letter: clean[0]?.toUpperCase() ?? "?",
    bg: AVATAR_COLORS[hash % AVATAR_COLORS.length],
  };
}

type TimeRange = "week" | "this-month" | "month" | "3months" | "all";
type TxTypeFilter = "all" | "expense" | "income";

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}
function formatUSDSigned(v: number) {
  const abs = formatUSD(Math.abs(v));
  return v >= 0 ? `+${abs}` : `-${abs}`;
}
function cutoffFor(range: TimeRange): Date {
  const d = new Date();
  switch (range) {
    case "week":      d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d;
    case "this-month": return new Date(d.getFullYear(), d.getMonth(), 1);
    case "month":     d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d;
    case "3months":   d.setMonth(d.getMonth() - 3); d.setHours(0,0,0,0); return d;
    default:          return new Date(0);
  }
}
function rangeLabel(range: TimeRange): string {
  switch (range) {
    case "week":       return "Last 7 days";
    case "this-month": return "This month";
    case "month":      return "Last 30 days";
    case "3months":    return "Last 90 days";
    default:           return "All time";
  }
}
function timeSince(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SYNC_LS_KEY = "steward:lastSynced";

export function TransactionsView({ transactions: initialTransactions, accounts }: Props) {
  const router = useRouter();
  const [txList, setTxList] = useState<Transaction[]>(initialTransactions);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("this-month");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop updates (after router.refresh) into local state
  useEffect(() => { setTxList(initialTransactions); }, [initialTransactions]);

  // Read last-synced from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SYNC_LS_KEY);
      if (stored) setLastSynced(stored);
    } catch {}
  }, []);

  // Auto-dismiss toast
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel("transactions-live")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newTx = payload.new as Transaction;
            // Only react to Plaid-sourced (non-manual, non-pending) transactions
            if (!newTx.is_manual && !newTx.is_pending) {
              setTxList((prev) => {
                if (prev.some((t) => t.id === newTx.id)) return prev;
                return [newTx, ...prev];
              });
              showToast(`New transaction: ${newTx.merchant ?? "Unknown"} ${formatUSD(Math.abs(newTx.amount))}`);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Remove reconciled pending transaction from local state
            const deletedId = (payload.old as { id: string }).id;
            setTxList((prev) => prev.filter((t) => t.id !== deletedId));
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showToast]);

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(timeRange);
    const q = search.trim().toLowerCase();
    return txList.filter((tx) => {
      if (new Date(tx.date + "T12:00:00") < cutoff) return false;
      if (accountFilter !== "all" && tx.account_id !== accountFilter) return false;
      if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;
      if (typeFilter === "expense" && tx.amount >= 0) return false;
      if (typeFilter === "income" && tx.amount <= 0) return false;
      if (q && !(tx.merchant ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txList, timeRange, accountFilter, categoryFilter, typeFilter, search]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filtered) {
      if (tx.amount >= 0) continue;
      const key = tx.category ?? "Other";
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const totalExpenses = filtered.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const totalIncome   = filtered.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const netAmount     = totalIncome - totalExpenses;
  const needsTotal    = filtered.filter((tx) => tx.amount < 0 && tx.is_need === true).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const wantsTotal    = filtered.filter((tx) => tx.amount < 0 && tx.is_need === false).reduce((s, tx) => s + Math.abs(tx.amount), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      if (!map.has(tx.date)) map.set(tx.date, []);
      map.get(tx.date)!.push(tx);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  async function deleteTx(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeletingId(id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
    setTxList((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (res.ok) {
        const now = new Date().toISOString();
        localStorage.setItem(SYNC_LS_KEY, now);
        setLastSynced(now);
        router.refresh();
        showToast("Sync complete");
      }
    } finally {
      setSyncing(false);
    }
  }

  const hasActiveFilters = timeRange !== "this-month" || accountFilter !== "all" || categoryFilter !== "all" || typeFilter !== "all" || search !== "";
  const selectClass = "select-pill rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] pl-3 pr-8 py-2 text-sm text-[var(--text-2)] focus:border-emerald-500/40 focus:outline-none transition cursor-pointer";

  return (
    <section className="min-h-screen p-4 md:p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 animate-fade-up">
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-700/40 bg-emerald-950/90 px-4 py-2.5 text-sm font-medium text-emerald-300 shadow-xl backdrop-blur-md">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {toast}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">Transactions</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              {rangeLabel(timeRange)} · {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Last synced + sync button */}
            <button
              type="button"
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)] transition hover:border-emerald-700/40 hover:text-emerald-400 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {lastSynced ? timeSince(lastSynced) : "Sync"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            { label: "Spent",  value: formatUSD(totalExpenses),   color: "text-red-400"     },
            { label: "Income", value: formatUSD(totalIncome),     color: "text-emerald-400" },
            { label: "Net",    value: formatUSDSigned(netAmount), color: netAmount >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Needs",  value: formatUSD(needsTotal),      color: "text-blue-400"    },
            { label: "Wants",  value: formatUSD(wantsTotal),      color: "text-purple-400"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">{label}</p>
              <p className={`mt-1.5 text-[17px] font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mt-5">
          <input
            type="text"
            placeholder="Search merchant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-1)] placeholder-[var(--text-3)] transition focus:border-emerald-500/40 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            { value: timeRange,      onChange: (v: string) => setTimeRange(v as TimeRange),     options: [{ v: "week", l: "Last 7 days" }, { v: "this-month", l: "This month" }, { v: "month", l: "Last 30 days" }, { v: "3months", l: "Last 90 days" }, { v: "all", l: "All time" }] },
            { value: typeFilter,     onChange: (v: string) => setTypeFilter(v as TxTypeFilter), options: [{ v: "all", l: "All types" }, { v: "expense", l: "Expenses only" }, { v: "income", l: "Income only" }] },
            { value: accountFilter,  onChange: (v: string) => setAccountFilter(v),              options: [{ v: "all", l: "All accounts" }, ...accounts.map((a) => ({ v: a.id, l: a.name }))] },
            { value: categoryFilter, onChange: (v: string) => setCategoryFilter(v),             options: [{ v: "all", l: "All categories" }, ...CATEGORIES.map((c) => ({ v: c, l: c }))] },
          ].map(({ value, onChange, options }, i) => (
            <div key={i} className="relative">
              <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-3)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          ))}
          {hasActiveFilters && (
            <button type="button" onClick={() => { setTimeRange("this-month"); setTypeFilter("all"); setAccountFilter("all"); setCategoryFilter("all"); setSearch(""); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)] transition hover:text-[var(--text-1)]">
              Reset
            </button>
          )}
        </div>

        {/* Spending by category */}
        {categoryTotals.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Spending by category</p>
            <div className="space-y-2">
              {categoryTotals.slice(0, 8).map(([cat, total]) => {
                const pct = Math.round((total / totalExpenses) * 100);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-[var(--text-2)]">{cat}</span>
                      <span className="text-[var(--text-3)]">{formatUSD(total)} · {pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
                      <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Grouped transaction list */}
        <div className="mt-6 space-y-6">
          {txList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
              <p className="font-medium text-[var(--text-2)]">No transactions yet</p>
              <p className="mt-1 text-sm text-[var(--text-3)]">Log your first purchase or income to start tracking.</p>
              <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
                Add your first transaction
              </button>
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
              <p className="text-[var(--text-3)]">No transactions match the current filters.</p>
              <button type="button" onClick={() => { setTimeRange("this-month"); setTypeFilter("all"); setAccountFilter("all"); setCategoryFilter("all"); }} className="mt-3 text-sm text-[var(--text-3)] underline hover:text-[var(--text-2)]">
                Clear filters
              </button>
            </div>
          ) : (
            grouped.map(([date, txs]) => {
              const dayExpenses = txs.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
              const dayIncome   = txs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
              const dayNet = dayIncome - dayExpenses;

              return (
                <div key={date}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <p className={`text-xs font-medium ${dayNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {formatUSDSigned(dayNet)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {txs.map((tx) => {
                      const isExpense = tx.amount < 0;
                      const av = merchantAvatar(tx.merchant);
                      return (
                        <div
                          key={tx.id}
                          className={`flex items-center justify-between rounded-2xl border bg-[var(--bg-card)] px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] ${tx.is_pending ? "border-amber-700/40" : "border-[var(--border)]"}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${av.bg}`}>
                              {av.letter}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-[var(--text-1)]">{tx.merchant || "—"}</p>
                                {tx.is_pending && (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">pending</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-3)]">
                                {tx.category && (
                                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[var(--text-2)]">{tx.category}</span>
                                )}
                                {tx.is_need === true  && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-400">need</span>}
                                {tx.is_need === false && <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-400">want</span>}
                                {tx.account_id && accountMap[tx.account_id] && <span>{accountMap[tx.account_id]}</span>}
                                {tx.notes && <span className="italic text-[var(--text-3)]">{tx.notes}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-shrink-0 items-center gap-2">
                            <p className={`text-sm font-semibold ${isExpense ? "text-red-400" : "text-emerald-400"}`}>
                              {isExpense ? `-${formatUSD(Math.abs(tx.amount))}` : `+${formatUSD(tx.amount)}`}
                            </p>
                            <button type="button" onClick={() => { setEditing(tx); setModalOpen(true); }} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-3)] transition hover:text-[var(--text-1)]">
                              Edit
                            </button>
                            <button type="button" onClick={() => deleteTx(tx.id)} disabled={deletingId === tx.id} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-3)] transition hover:border-red-800/60 hover:text-red-400 disabled:opacity-40">
                              {deletingId === tx.id ? "…" : "Del"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddTransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        accounts={accounts}
        transaction={editing}
      />
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
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
    case "week":
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    case "this-month":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "month":
      d.setMonth(d.getMonth() - 1);
      d.setHours(0, 0, 0, 0);
      return d;
    case "3months":
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return d;
    default:
      return new Date(0);
  }
}

function rangeLabel(range: TimeRange): string {
  switch (range) {
    case "week": return "Last 7 days";
    case "this-month": return "This month";
    case "month": return "Last 30 days";
    case "3months": return "Last 90 days";
    default: return "All time";
  }
}

export function TransactionsView({ transactions, accounts }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("this-month");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("all");
  const [search, setSearch] = useState("");

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  const filtered = useMemo(() => {
    const cutoff = cutoffFor(timeRange);
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (new Date(tx.date + "T12:00:00") < cutoff) return false;
      if (accountFilter !== "all" && tx.account_id !== accountFilter) return false;
      if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;
      if (typeFilter === "expense" && tx.amount >= 0) return false;
      if (typeFilter === "income" && tx.amount <= 0) return false;
      if (q && !(tx.merchant ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, timeRange, accountFilter, categoryFilter, typeFilter, search]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filtered) {
      if (tx.amount >= 0) continue;
      const key = tx.category ?? "Other";
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const totalExpenses = filtered
    .filter((tx) => tx.amount < 0)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const totalIncome = filtered
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);
  const netAmount = totalIncome - totalExpenses;
  const needsTotal = filtered
    .filter((tx) => tx.amount < 0 && tx.is_need === true)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const wantsTotal = filtered
    .filter((tx) => tx.amount < 0 && tx.is_need === false)
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);

  // Group by date descending
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
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    router.refresh();
  }

  const selectClass =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500";

  const hasActiveFilters =
    timeRange !== "this-month" ||
    accountFilter !== "all" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    search !== "";

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-white">Transactions</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {rangeLabel(timeRange)} · {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Add transaction
          </button>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Spent</p>
            <p className="mt-2 text-lg font-semibold text-red-400">{formatUSD(totalExpenses)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Income</p>
            <p className="mt-2 text-lg font-semibold text-emerald-400">{formatUSD(totalIncome)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${netAmount >= 0 ? "border-emerald-900/50 bg-emerald-950/20" : "border-red-900/50 bg-red-950/20"}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Net</p>
            <p className={`mt-2 text-lg font-semibold ${netAmount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatUSDSigned(netAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Needs</p>
            <p className="mt-2 text-lg font-semibold text-blue-400">{formatUSD(needsTotal)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Wants</p>
            <p className="mt-2 text-lg font-semibold text-purple-400">{formatUSD(wantsTotal)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-5">
          <input
            type="text"
            placeholder="Search merchant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
          >
            <option value="week">Last 7 days</option>
            <option value="this-month">This month</option>
            <option value="month">Last 30 days</option>
            <option value="3months">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select
            className={selectClass}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TxTypeFilter)}
          >
            <option value="all">All types</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
          </select>
          <select
            className={selectClass}
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setTimeRange("this-month");
                setTypeFilter("all");
                setAccountFilter("all");
                setCategoryFilter("all");
                setSearch("");
              }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Spending by category */}
        {categoryTotals.length > 0 && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Spending by category
            </p>
            <div className="space-y-2">
              {categoryTotals.slice(0, 8).map(([cat, total]) => {
                const pct = Math.round((total / totalExpenses) * 100);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-zinc-300">{cat}</span>
                      <span className="text-zinc-400">{formatUSD(total)} · {pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Grouped list with daily totals */}
        <div className="mt-6 space-y-6">
          {transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
              <p className="font-medium text-zinc-400">No transactions yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                Log your first purchase or income to start tracking your money.
              </p>
              <button
                type="button"
                onClick={() => { setEditing(null); setModalOpen(true); }}
                className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Add your first transaction
              </button>
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
              <p className="text-zinc-500">No transactions match the current filters.</p>
              <button
                type="button"
                onClick={() => {
                  setTimeRange("this-month");
                  setTypeFilter("all");
                  setAccountFilter("all");
                  setCategoryFilter("all");
                }}
                className="mt-3 text-sm text-zinc-400 underline hover:text-zinc-200"
              >
                Clear filters
              </button>
            </div>
          ) : (
            grouped.map(([date, txs]) => {
              const dayExpenses = txs
                .filter((tx) => tx.amount < 0)
                .reduce((s, tx) => s + Math.abs(tx.amount), 0);
              const dayIncome = txs
                .filter((tx) => tx.amount > 0)
                .reduce((s, tx) => s + tx.amount, 0);
              const dayNet = dayIncome - dayExpenses;

              return (
                <div key={date}>
                  {/* Date header with daily total */}
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric"
                      })}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        dayNet >= 0 ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {formatUSDSigned(dayNet)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {txs.map((tx) => {
                      const isExpense = tx.amount < 0;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-700"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {(() => {
                              const av = merchantAvatar(tx.merchant);
                              return (
                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${av.bg}`}>
                                  {av.letter}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-100">
                              {tx.merchant || "—"}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                              {tx.category && (
                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400">
                                  {tx.category}
                                </span>
                              )}
                              {tx.is_need === true && (
                                <span className="rounded-full bg-blue-900/40 px-2 py-0.5 text-blue-400">
                                  need
                                </span>
                              )}
                              {tx.is_need === false && (
                                <span className="rounded-full bg-purple-900/40 px-2 py-0.5 text-purple-400">
                                  want
                                </span>
                              )}
                              {tx.account_id && accountMap[tx.account_id] && (
                                <span>{accountMap[tx.account_id]}</span>
                              )}
                              {tx.notes && (
                                <span className="italic text-zinc-600">{tx.notes}</span>
                              )}
                            </div>
                            </div>{/* end min-w-0 */}
                          </div>{/* end flex items-center gap-3 */}
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <p
                              className={`text-sm font-semibold ${
                                isExpense ? "text-red-400" : "text-emerald-400"
                              }`}
                            >
                              {isExpense
                                ? `-${formatUSD(Math.abs(tx.amount))}`
                                : `+${formatUSD(tx.amount)}`}
                            </p>
                            <button
                              type="button"
                              onClick={() => { setEditing(tx); setModalOpen(true); }}
                              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTx(tx.id)}
                              disabled={deletingId === tx.id}
                              className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-600 hover:border-red-900 hover:text-red-400 disabled:opacity-40"
                            >
                              {deletingId === tx.id ? "..." : "Del"}
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

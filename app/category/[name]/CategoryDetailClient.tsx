"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TabPills } from "@/components/ui/TabPills";

interface Tx { id: string; date: string; merchant: string | null; amount: number; is_pending: boolean }

const TIME_TABS = [
  { id: "month", label: "This month" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "TODAY";
  if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
}

export function CategoryDetailClient({ transactions, categoryLabel }: { transactions: Tx[]; categoryLabel: string }) {
  const [range, setRange] = useState("month");

  const filtered = useMemo(() => {
    const cutoff = range === "month"
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : range === "90d"
      ? new Date(Date.now() - 90 * 86_400_000)
      : new Date(0);
    return transactions.filter((t) => new Date(t.date + "T12:00:00") >= cutoff);
  }, [transactions, range]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const tx of filtered) {
      if (!map.has(tx.date)) map.set(tx.date, []);
      map.get(tx.date)!.push(tx);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="mt-6">
      <TabPills tabs={TIME_TABS} active={range} onChange={setRange} />
      <div className="mt-5 space-y-5">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-sm text-[var(--text-3)]">No {categoryLabel} spending in this range.</p>
          </div>
        ) : (
          grouped.map(([date, txs]) => (
            <div key={date}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">{dayLabel(date)}</p>
              <div className="space-y-1">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between rounded-2xl border bg-[var(--bg-card)] px-4 py-3 ${tx.is_pending ? "border-amber-700/30" : "border-[var(--border)]"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/merchant/${encodeURIComponent(tx.merchant ?? "Unknown")}`}
                        className="text-sm font-medium text-[var(--text-1)] hover:text-[var(--accent)] transition-colors truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tx.merchant ?? "—"}
                      </Link>
                      {tx.is_pending && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 flex-shrink-0">pending</span>
                      )}
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${tx.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {tx.amount < 0 ? "−" : "+"}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

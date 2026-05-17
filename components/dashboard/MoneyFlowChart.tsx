"use client";

import { formatUSD } from "@/lib/format";

interface Props {
  income: number;
  spent: number;
}

export function MoneyFlowChart({ income, spent }: Props) {
  const max = Math.max(income, spent, 1);
  const incomeH = Math.round((income / max) * 60);
  const spentH = Math.round((spent / max) * 60);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-3">Money Flow · This Month</p>
      <div className="flex items-end gap-4" style={{ height: 80 }}>
        {/* Income bar */}
        <div className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold text-emerald-500">{formatUSD(income)}</span>
          <div
            className="w-full rounded-t-lg bg-emerald-500/70"
            style={{ height: incomeH }}
          />
          <span className="text-[10px] text-[var(--text-3)]">Income</span>
        </div>
        {/* Spent bar */}
        <div className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold text-amber-400">{formatUSD(spent)}</span>
          <div
            className="w-full rounded-t-lg bg-amber-400/70"
            style={{ height: spentH }}
          />
          <span className="text-[10px] text-[var(--text-3)]">Spent</span>
        </div>
      </div>
    </div>
  );
}

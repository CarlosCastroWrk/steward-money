"use client";

import { useEffect, useState } from "react";
import { formatUSD } from "@/lib/format";

interface MannaData {
  date: string;
  dailyAllowance: number;
  spentToday: number;
  remaining: number;
}

export function MannaCard() {
  const [data, setData] = useState<MannaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents/manna")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="h-3 w-20 rounded shimmer mb-2" />
        <div className="h-8 w-32 rounded shimmer" />
      </div>
    );
  }

  if (!data || data.dailyAllowance <= 0) return null;

  const pct = Math.min(100, data.dailyAllowance > 0 ? (data.remaining / data.dailyAllowance) * 100 : 0);
  const isLow = pct < 25;
  const isGone = data.remaining <= 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-amber-400">M</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Manna · Today</p>
        </div>
        <p className="text-[10px] text-[var(--text-3)]">Daily bread</p>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-bold ${isGone ? "text-red-400" : isLow ? "text-amber-400" : "text-[var(--text-1)]"}`}>
            {formatUSD(data.remaining)}
          </p>
          <p className="text-[10px] text-[var(--text-3)] mt-0.5">of {formatUSD(data.dailyAllowance)} remaining</p>
        </div>
        {data.spentToday > 0 && (
          <p className="text-xs text-[var(--text-3)]">Spent: {formatUSD(data.spentToday)}</p>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
        <div
          className={`h-1.5 rounded-full transition-all ${isGone ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-amber-400"}`}
          style={{ width: `${Math.max(0, pct)}%` }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { formatUSD } from "@/lib/format";
import type { AllocationResult } from "@/app/api/agents/allocate/route";

export function AllocationCard({ income }: { income: number }) {
  const [data, setData] = useState<AllocationResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (income <= 0) return;
    fetch(`/api/agents/allocate?income=${income}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, [income]);

  if (dismissed || !data || income <= 0) return null;

  const total = data.lines.reduce((s, l) => s + l.amount, 0) + data.flex;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
        <AgentAvatar agent="luka" size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">Paycheck Allocation</p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-1)]">Here&apos;s where your {formatUSD(income)} goes:</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-[var(--text-3)] hover:text-[var(--text-2)] text-lg leading-none">×</button>
      </div>

      <div className="space-y-3 p-4">
        {data.lines.map((line) => {
          const pct = total > 0 ? (line.amount / total) * 100 : 0;
          return (
            <div key={line.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span>{line.emoji}</span>
                  {line.label}
                </span>
                <span className="font-semibold text-[var(--text-1)]">{formatUSD(line.amount)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
                <div className={`h-1.5 rounded-full ${line.color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}

        <div className="border-t border-[var(--border)] pt-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-2)]">
              <span>✨</span>
              Safe to spend (flex)
            </span>
            <span className="text-sm font-bold text-emerald-500">{formatUSD(data.flex)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-4 pt-0">
        <button
          onClick={() => setDismissed(true)}
          className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-deep)]"
        >
          Looks good
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-elevated)]"
        >
          Adjust
        </button>
      </div>
    </div>
  );
}

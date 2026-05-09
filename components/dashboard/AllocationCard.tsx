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
    <div className="rounded-xl border border-blue-900/50 bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <AgentAvatar agent="luka" size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Paycheck Allocation</p>
          <p className="text-sm font-medium text-white mt-0.5">Here&apos;s where your {formatUSD(income)} goes:</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-zinc-600 hover:text-zinc-400 text-lg leading-none">×</button>
      </div>

      <div className="p-4 space-y-3">
        {data.lines.map((line) => {
          const pct = total > 0 ? (line.amount / total) * 100 : 0;
          return (
            <div key={line.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <span>{line.emoji}</span>
                  {line.label}
                </span>
                <span className="font-semibold text-white">{formatUSD(line.amount)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className={`h-1.5 rounded-full ${line.color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}

        <div className="pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300 flex items-center gap-1.5">
              <span>✨</span>
              Safe to spend (flex)
            </span>
            <span className="text-sm font-bold text-green-400">{formatUSD(data.flex)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-4 pt-0">
        <button
          onClick={() => setDismissed(true)}
          className="flex-1 rounded-lg bg-white text-black text-sm font-medium py-2.5 hover:bg-zinc-100 transition-colors"
        >
          Looks good
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-1 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium py-2.5 hover:bg-zinc-800 transition-colors"
        >
          Adjust
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatUSD } from "@/lib/format";

interface AllocationLine {
  label: string;
  amount: number;
  color: string;
  emoji: string;
}

interface AllocationResult {
  income: number;
  lines: AllocationLine[];
  flex: number;
}

interface Props {
  onDismiss: () => void;
}

export function AllocationCard({ onDismiss }: Props) {
  const [data, setData] = useState<AllocationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents/allocate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function dismiss() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_settings").update({ allocation_pending: false }).eq("user_id", user.id);
    }
    onDismiss();
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 animate-pulse">
        <div className="h-4 w-32 rounded bg-[var(--bg-elevated)] mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded bg-[var(--bg-elevated)]" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-0.5">
            Paycheck Landed
          </p>
          <p className="text-sm font-medium text-[var(--text-1)]">
            Here&apos;s how to allocate {formatUSD(data.income)}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {data.lines.map((line, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{line.emoji}</span>
              <span className="text-xs text-[var(--text-2)]">{line.label}</span>
            </div>
            <span className="text-xs font-semibold text-[var(--text-1)]">{formatUSD(line.amount)}</span>
          </div>
        ))}
        {data.flex > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--accent)]/20 pt-2 mt-2">
            <span className="text-xs text-[var(--text-3)]">Flex / Safe to Spend</span>
            <span className="text-xs font-semibold text-emerald-500">{formatUSD(data.flex)}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="w-full rounded-xl bg-[var(--accent)] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Got it
      </button>
    </div>
  );
}

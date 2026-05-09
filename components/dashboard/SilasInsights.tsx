"use client";

import { useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { createClient } from "@/lib/supabase/client";

type Insight = {
  id: string;
  insight_text: string;
  insight_type: string;
};

export function SilasInsights({ insights: initial }: { insights: Insight[] }) {
  const [insights, setInsights] = useState(initial);

  async function dismiss(id: string) {
    const supabase = createClient();
    await supabase.from("pulse_insights").update({ is_dismissed: true }).eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="mb-3 flex items-center gap-3">
        <AgentAvatar agent="silas" />
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--silas)" }}>
          Silas Sees
        </p>
      </div>

      {insights.length === 0 ? (
        <p className="text-xs text-[var(--text-3)]">
          Silas needs a few more transactions to surface patterns.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5"
            >
              <p className="flex-1 text-xs text-[var(--text-2)] leading-relaxed">{insight.insight_text}</p>
              <button
                onClick={() => dismiss(insight.id)}
                className="flex-shrink-0 text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors text-base leading-none mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

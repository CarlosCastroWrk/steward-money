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

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-3 mb-2">
          <AgentAvatar agent="silas" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600">Silas Sees</p>
        </div>
        <p className="text-xs text-zinc-500">Silas needs a few more transactions to see your patterns.</p>
      </div>
    );
  }

  async function dismiss(id: string) {
    const supabase = createClient();
    await supabase.from("pulse_insights").update({ is_dismissed: true }).eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3 mb-3">
        <AgentAvatar agent="silas" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600">Silas Sees</p>
      </div>
      <div className="flex flex-col gap-2">
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-2.5">
            <p className="flex-1 text-xs text-zinc-300 leading-relaxed">{insight.insight_text}</p>
            <button
              onClick={() => dismiss(insight.id)}
              className="flex-shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors text-base leading-none mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

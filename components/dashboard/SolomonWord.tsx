"use client";

import { useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

type WeeklyReport = {
  solomon_word: string | null;
  stewardship_score: number | null;
  week_start: string;
  lived_within_provision: boolean | null;
  giving_honored: boolean | null;
};

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="absolute -rotate-90" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export function SolomonWord({ report }: { report: WeeklyReport | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!report?.solomon_word) return null;

  return (
    <div className="rounded-xl border border-amber-900/40 bg-amber-950/20">
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <AgentAvatar agent="solomon" size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Solomon&apos;s Word</p>
          {!expanded && (
            <p className="mt-0.5 text-xs text-zinc-400 truncate">{report.solomon_word}</p>
          )}
        </div>
        {report.stewardship_score != null && <ScoreRing score={report.stewardship_score} />}
        <span className="text-zinc-600 text-xs ml-1">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-amber-900/30 px-4 pb-4">
          <p className="text-sm text-zinc-300 leading-relaxed pt-3">{report.solomon_word}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            {report.lived_within_provision != null && (
              <span className={report.lived_within_provision ? "text-green-500" : "text-red-400"}>
                {report.lived_within_provision ? "✓ Lived within provision" : "✕ Exceeded provision"}
              </span>
            )}
            {report.giving_honored != null && (
              <span className={report.giving_honored ? "text-green-500" : "text-amber-400"}>
                {report.giving_honored ? "✓ Giving honored" : "· Giving not recorded"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

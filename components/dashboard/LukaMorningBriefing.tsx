"use client";

import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { formatUSD } from "@/lib/format";

type BriefingData = {
  safeToSpend: number;
  liquidTotal: number;
  billsDueSoon: number;
  nextIncomeDate: string | null;
  displayName: string;
  alertCount: number;
  billsDueThisWeek: Array<{ name: string; amount: number }>;
};

function generateBriefing(data: BriefingData): string {
  const { safeToSpend, liquidTotal, billsDueSoon, nextIncomeDate, displayName, alertCount, billsDueThisWeek } = data;
  const name = displayName || "there";

  if (alertCount > 0 && billsDueSoon > 0) {
    return `Hey ${name} — ${alertCount} thing${alertCount > 1 ? "s" : ""} need${alertCount === 1 ? "s" : ""} your attention. Safe to spend is ${formatUSD(safeToSpend)}.`;
  }

  if (billsDueThisWeek.length >= 3) {
    const total = billsDueThisWeek.reduce((s, b) => s + b.amount, 0);
    return `${billsDueThisWeek.length} bills due this week totaling ${formatUSD(total)}. Balance covers it. You're on track.`;
  }

  if (billsDueThisWeek.length === 0 && safeToSpend > 200) {
    const incomeLabel = nextIncomeDate
      ? `Paycheck expected ${new Date(nextIncomeDate).toLocaleDateString("en-US", { weekday: "long" })}.`
      : "";
    return `Quiet week. No bills due. ${incomeLabel} Good moment to push toward your goals.`.trim();
  }

  const biggestBill = billsDueThisWeek[0];
  if (biggestBill) {
    return `Hey ${name} — safe to spend is ${formatUSD(safeToSpend)}. ${biggestBill.name} (${formatUSD(biggestBill.amount)}) is coming up. You're covered.`;
  }

  return `Hey ${name} — safe to spend is ${formatUSD(safeToSpend)}. Liquid cash is ${formatUSD(liquidTotal)}.`;
}

export function LukaMorningBriefing({ data }: { data: BriefingData }) {
  const [dismissed, setDismissed] = useState(false);
  const briefing = generateBriefing(data);

  useEffect(() => {
    const key = `luka-briefing-${new Date().toDateString()}`;
    if (localStorage.getItem(key) === "1") setDismissed(true);
  }, []);

  function dismiss() {
    const key = `luka-briefing-${new Date().toDateString()}`;
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-blue-900/50 bg-blue-950/30 p-4">
      <div className="flex items-start gap-3">
        <AgentAvatar agent="luka" size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-1)] leading-relaxed">{briefing}</p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors text-lg leading-none mt-0.5"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

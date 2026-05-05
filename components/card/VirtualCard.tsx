"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/format";

type Bucket = {
  label: string;
  amount: number;
  emoji: string;
  color: string;
};

type Props = {
  safeToSpend: number;
  liquidTotal: number;
  emergencyBuffer: number;
  billsDueSoon: number;
  givingDeducted: number;
  savingsDeducted: number;
  tradingDeducted: number;
  weeklyNeedsTotal: number;
  displayName: string;
};

export function VirtualCard({
  safeToSpend,
  liquidTotal,
  emergencyBuffer,
  billsDueSoon,
  givingDeducted,
  savingsDeducted,
  tradingDeducted,
  weeklyNeedsTotal,
  displayName,
}: Props) {
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [verdict, setVerdict] = useState<null | "good" | "tight" | "over">(null);
  const [verdictDetail, setVerdictDetail] = useState("");

  const buckets: Bucket[] = [
    { label: "Safe to spend", amount: Math.max(0, safeToSpend), emoji: "🟣", color: "text-purple-400" },
    { label: "Weekly needs reserve", amount: weeklyNeedsTotal, emoji: "🟢", color: "text-green-400" },
    { label: "Bills reserved", amount: billsDueSoon, emoji: "🏠", color: "text-amber-400" },
    { label: "Emergency buffer", amount: emergencyBuffer, emoji: "🛡️", color: "text-blue-400" },
    { label: "Giving set aside", amount: givingDeducted, emoji: "🙏", color: "text-green-500" },
    { label: "Savings set aside", amount: savingsDeducted, emoji: "💰", color: "text-cyan-400" },
    ...(tradingDeducted > 0 ? [{ label: "Trading set aside", amount: tradingDeducted, emoji: "📈", color: "text-teal-400" }] : []),
  ].filter((b) => b.amount > 0);

  function simulate() {
    const amt = parseFloat(purchaseAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (amt <= safeToSpend) {
      setVerdict("good");
      setVerdictDetail(`You're covered. ${formatUSD(safeToSpend - amt)} left after this.`);
    } else if (amt <= safeToSpend + weeklyNeedsTotal) {
      setVerdict("tight");
      const overage = amt - safeToSpend;
      setVerdictDetail(`This exceeds your safe-to-spend by ${formatUSD(overage)}. It would dip into your needs reserve.`);
    } else {
      setVerdict("over");
      const short = amt - safeToSpend - weeklyNeedsTotal;
      setVerdictDetail(`Not enough across your flex and needs buckets. You'd be short ${formatUSD(short)}.`);
    }
  }

  function resetSimulator() {
    setPurchaseAmount("");
    setVerdict(null);
    setVerdictDetail("");
  }

  return (
    <div className="space-y-6">
      {/* Physical card visual */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2d1569] via-[#4a1d96] to-[#1a0f4e] p-6 shadow-2xl shadow-purple-900/40 aspect-[1.586/1]">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-6 -left-2 h-24 w-48 rounded-full bg-purple-400/10 blur-2xl" />
        <div className="relative flex flex-col h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40">Steward Money</p>
              <p className="text-xs text-white/60 mt-0.5">{displayName}</p>
            </div>
            <div className="h-8 w-12 rounded bg-gradient-to-br from-amber-300 to-amber-500 opacity-80" />
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Available to spend</p>
            <p className="text-4xl font-bold text-white tracking-tight">{formatUSD(Math.max(0, safeToSpend))}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[10px] tracking-[0.2em] text-white/30">•••• •••• •••• 0000</p>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Virtual</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bucket breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Protected buckets</p>
        <div className="divide-y divide-zinc-800">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-zinc-300 flex items-center gap-2">
                <span>{b.emoji}</span>
                {b.label}
              </span>
              <span className={`text-sm font-semibold ${b.color}`}>{formatUSD(b.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/30">
            <span className="text-sm font-medium text-white">Total liquid cash</span>
            <span className="text-sm font-bold text-white">{formatUSD(liquidTotal)}</span>
          </div>
        </div>
      </div>

      {/* Spend simulator */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Spend simulator</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
            <input
              type="number"
              value={purchaseAmount}
              onChange={(e) => { setPurchaseAmount(e.target.value); setVerdict(null); setVerdictDetail(""); }}
              onKeyDown={(e) => e.key === "Enter" && simulate()}
              placeholder="How much do you want to spend?"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-7 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-purple-600 focus:outline-none"
            />
          </div>
          <button
            onClick={simulate}
            className="rounded-lg bg-white text-black text-sm font-medium px-4 hover:bg-zinc-100 transition-colors"
          >
            Check
          </button>
        </div>

        {verdict && (
          <div className={`mt-3 rounded-lg border p-3 ${
            verdict === "good" ? "border-green-800/50 bg-green-950/30" :
            verdict === "tight" ? "border-amber-800/50 bg-amber-950/30" :
            "border-red-800/50 bg-red-950/30"
          }`}>
            <p className={`text-sm font-medium ${
              verdict === "good" ? "text-green-400" :
              verdict === "tight" ? "text-amber-400" :
              "text-red-400"
            }`}>
              {verdict === "good" ? "✓ You're good." : verdict === "tight" ? "⚠ Tight." : "✕ Not enough."}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{verdictDetail}</p>
            {verdict === "tight" && (
              <div className="mt-2 flex gap-2">
                <button onClick={resetSimulator} className="text-xs border border-amber-800/50 text-amber-400 px-3 py-1 rounded-lg hover:bg-amber-950/40 transition-colors">
                  Cancel
                </button>
              </div>
            )}
            {verdict === "good" && (
              <button onClick={resetSimulator} className="mt-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors">
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-zinc-700">
        Steward Money physical card — coming soon. Spend only what&apos;s been cleared.
      </p>
    </div>
  );
}

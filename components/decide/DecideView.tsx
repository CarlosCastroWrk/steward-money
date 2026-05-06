"use client";

import { useState } from "react";
import type { SafeToSpendResult } from "@/lib/safe-to-spend";

type Props = { result: SafeToSpendResult };

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

type Verdict = "yes" | "tight" | "buffer" | "no" | "empty";

function getVerdict(amount: number, result: SafeToSpendResult): Verdict {
  if (amount <= 0) return "empty";
  const { safeToSpend, safeToSpendRaw, emergencyBuffer } = result;
  const remaining = safeToSpend - amount;
  if (remaining >= safeToSpend * 0.5) return "yes";
  if (remaining >= 0) return "tight";
  if (safeToSpendRaw - amount >= -emergencyBuffer * 0.25) return "buffer";
  return "no";
}

const verdictConfig = {
  yes: {
    label: "Yes — go for it",
    sub: "You can afford this comfortably.",
    color: "text-emerald-500",
    bg: "border-emerald-500/20 bg-emerald-500/5",
  },
  tight: {
    label: "Yes, but keep an eye on it",
    sub: "You can afford it, but it uses a significant chunk of your budget.",
    color: "text-amber-500",
    bg: "border-amber-500/20 bg-amber-500/5",
  },
  buffer: {
    label: "This cuts into your buffer",
    sub: "Technically possible but dips into your safety net. Wait if you can.",
    color: "text-amber-500",
    bg: "border-amber-500/20 bg-amber-500/5",
  },
  no: {
    label: "Not right now",
    sub: "This would put you in a tough spot. Wait for your next paycheck.",
    color: "text-red-500",
    bg: "border-red-500/20 bg-red-500/5",
  },
  empty: {
    label: "",
    sub: "",
    color: "",
    bg: "",
  },
};

export function DecideView({ result }: Props) {
  const [input, setInput] = useState("");
  const amount = Number(input) || 0;
  const verdict = getVerdict(amount, result);
  const remaining = result.safeToSpend - amount;

  const nextPaycheck = result.nextIncomeDate
    ? new Date(result.nextIncomeDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-2xl font-medium text-[var(--text-primary)]">Decide</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Enter a purchase amount to see if you can afford it right now.
        </p>

        {/* Big input */}
        <div className="mt-8 flex items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-5">
          <span className="text-3xl font-light text-[var(--text-muted)]">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            className="ml-2 flex-1 bg-transparent text-4xl font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
            autoFocus
          />
        </div>

        {/* Verdict */}
        {verdict !== "empty" && (
          <div className={`mt-6 rounded-2xl border p-6 ${verdictConfig[verdict].bg}`}>
            <p className={`text-xl font-semibold ${verdictConfig[verdict].color}`}>
              {verdictConfig[verdict].label}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{verdictConfig[verdict].sub}</p>

            {verdict === "no" && nextPaycheck && (
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Next paycheck:{" "}
                <span className="text-[var(--text-secondary)] font-medium">
                  {nextPaycheck} (+{formatUSD(result.nextIncomeAmount)})
                </span>
              </p>
            )}
          </div>
        )}

        {/* Breakdown */}
        {verdict !== "empty" && (
          <div className="mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              The math
            </h2>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span className="text-[var(--text-muted)]">Safe to spend now</span>
                <span className="font-medium text-[var(--text-primary)]">{formatUSD(result.safeToSpend)}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-[var(--text-muted)]">This purchase</span>
                <span className="font-medium text-red-500">-{formatUSD(amount)}</span>
              </li>
              <li className="flex justify-between border-t border-[var(--border-default)] pt-3">
                <span className="text-[var(--text-secondary)]">Left to spend</span>
                <span className={`font-semibold ${remaining >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {formatUSD(remaining)}
                </span>
              </li>
            </ul>

            {remaining < 0 && result.emergencyBuffer > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
                This would pull{" "}
                <span className="font-semibold">{formatUSD(Math.abs(remaining))}</span> from
                your{" "}
                <span className="font-semibold">{formatUSD(result.emergencyBuffer)}</span> emergency
                buffer.
              </div>
            )}
          </div>
        )}

        {/* Context panel */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {[
            { label: "Safe to spend", value: formatUSD(result.safeToSpend), sub: "After all deductions" },
            { label: "Emergency buffer", value: formatUSD(result.emergencyBuffer), sub: "Protected, do not spend" },
            { label: "Bills before payday", value: formatUSD(result.billsDueSoon), sub: "Already reserved" },
            { label: "Next paycheck", value: nextPaycheck ?? "Not set", sub: result.nextIncomeAmount > 0 ? `+${formatUSD(result.nextIncomeAmount)}` : "" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{item.value}</p>
              {item.sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

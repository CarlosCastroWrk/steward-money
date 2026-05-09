"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SafeToSpendResult } from "@/lib/safe-to-spend";

type Props = { result: SafeToSpendResult };

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
function formatUSDExact(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
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
    label: "You're clear",
    sub: "This fits comfortably within your budget.",
    color: "var(--color-income)",
    bg: "var(--color-income)",
    symbol: "✓",
  },
  tight: {
    label: "You can, but it's tight",
    sub: "Affordable, but uses a large chunk of your budget.",
    color: "#f59e0b",
    bg: "#f59e0b",
    symbol: "~",
  },
  buffer: {
    label: "This cuts into your buffer",
    sub: "Technically possible but dips into your safety net. Wait if you can.",
    color: "#f59e0b",
    bg: "#f59e0b",
    symbol: "!",
  },
  no: {
    label: "Not right now",
    sub: "This would put you in a tough spot. Wait for your next paycheck.",
    color: "var(--color-danger)",
    bg: "var(--color-danger)",
    symbol: "✕",
  },
  empty: {
    label: "",
    sub: "",
    color: "",
    bg: "",
    symbol: "",
  },
};

export function DecideView({ result }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [lukaLoading, setLukaLoading] = useState(false);
  const [lukaReply, setLukaReply] = useState("");

  const amount = Number(input) || 0;
  const verdict = getVerdict(amount, result);
  const remaining = result.safeToSpend - amount;
  const usagePct = result.safeToSpend > 0 ? Math.min(100, (amount / result.safeToSpend) * 100) : 100;

  const nextPaycheck = result.nextIncomeDate
    ? new Date(result.nextIncomeDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const askLuka = useCallback(async () => {
    if (amount <= 0) return;
    setLukaLoading(true);
    setLukaReply("");
    const prompt = `Should I spend ${formatUSDExact(amount)} right now? My safe-to-spend is ${formatUSD(result.safeToSpend)}.`;
    try {
      const res = await fetch("/api/luka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (data.refreshNeeded) router.refresh();
      setLukaReply(data.reply ?? "");
    } catch {
      setLukaReply("Couldn't reach Luka. Check your connection.");
    } finally {
      setLukaLoading(false);
    }
  }, [amount, result.safeToSpend, router]);

  const vc = verdict !== "empty" ? verdictConfig[verdict] : null;

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-1)]">Decide</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Enter an amount to see if you can afford it right now.
          </p>
        </div>

        {/* ── Big dollar input ─────────────────────────────────────────── */}
        <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-5 focus-within:border-[var(--accent)] transition-colors">
          <span className="text-3xl font-light text-[var(--text-3)]">$</span>
          <input
            type="number" inputMode="decimal"
            min="0"
            step="0.01"
            value={input}
            onChange={(e) => { setInput(e.target.value); setLukaReply(""); }}
            placeholder="0"
            className="ml-2 flex-1 bg-transparent text-4xl font-semibold text-[var(--text-1)] outline-none placeholder:text-[var(--text-dim)]"
            autoFocus
          />
          {amount > 0 && (
            <button
              onClick={() => { setInput(""); setLukaReply(""); }}
              className="ml-3 flex-shrink-0 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Verdict ──────────────────────────────────────────────────── */}
        {vc && (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: `1px solid color-mix(in srgb, ${vc.color} 25%, transparent)`, background: `color-mix(in srgb, ${vc.color} 6%, transparent)` }}
          >
            {/* Color stripe */}
            <div className="h-1" style={{ background: vc.color }} />

            <div className="p-5">
              {/* Symbol + label */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                  style={{ background: vc.color }}
                >
                  {vc.symbol}
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: vc.color }}>{vc.label}</p>
                  <p className="text-xs text-[var(--text-3)]">{vc.sub}</p>
                </div>
              </div>

              {/* Usage bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-[var(--text-3)] mb-1.5">
                  <span>Budget usage</span>
                  <span style={{ color: vc.color }}>{Math.round(usagePct)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${usagePct}%`, background: vc.color }}
                  />
                </div>
              </div>

              {/* Remaining */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3.5">
                <span className="text-sm text-[var(--text-3)]">Left after this</span>
                <span className={`font-mono text-lg font-bold ${remaining >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-danger)]"}`}>
                  {formatUSD(remaining)}
                </span>
              </div>

              {verdict === "no" && nextPaycheck && (
                <p className="mt-2 text-xs text-[var(--text-3)]">
                  Next paycheck:{" "}
                  <span className="font-medium text-[var(--text-2)]">
                    {nextPaycheck} (+{formatUSD(result.nextIncomeAmount)})
                  </span>
                </p>
              )}

              {/* Ask Luka */}
              {!lukaReply && (
                <button
                  onClick={askLuka}
                  disabled={lukaLoading}
                  className="mt-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: "var(--luka)", boxShadow: "0 2px 12px color-mix(in srgb, var(--luka) 30%, transparent)" }}
                >
                  {lukaLoading ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Asking Luka…
                    </>
                  ) : (
                    <>✦ Get Luka&apos;s take</>
                  )}
                </button>
              )}

              {lukaReply && (
                <div
                  className="mt-4 rounded-xl border px-4 py-3"
                  style={{
                    borderColor: "color-mix(in srgb, var(--luka) 20%, transparent)",
                    background: "color-mix(in srgb, var(--luka) 6%, transparent)",
                  }}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--luka)" }}>
                    Luka says
                  </p>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{lukaReply}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Breakdown ─────────────────────────────────────────────────── */}
        {verdict !== "empty" && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              The math
            </p>
            <div className="divide-y divide-[var(--border-subtle)]">
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-3)]">Safe to spend now</span>
                <span className="font-mono text-sm font-semibold text-[var(--text-1)]">{formatUSD(result.safeToSpend)}</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-[var(--text-3)]">This purchase</span>
                <span className="font-mono text-sm font-semibold text-[var(--color-danger)]">-{formatUSD(amount)}</span>
              </div>
              <div className="flex justify-between bg-[var(--bg-elevated)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-2)]">Remaining</span>
                <span className={`font-mono text-sm font-bold ${remaining >= 0 ? "text-[var(--color-income)]" : "text-[var(--color-danger)]"}`}>
                  {formatUSD(remaining)}
                </span>
              </div>
            </div>

            {remaining < 0 && result.emergencyBuffer > 0 && (
              <div className="mx-4 mb-4 mt-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                Pulls{" "}
                <span className="font-semibold">{formatUSD(Math.abs(remaining))}</span> from your{" "}
                <span className="font-semibold">{formatUSD(result.emergencyBuffer)}</span> emergency buffer.
              </div>
            )}
          </div>
        )}

        {/* ── Context grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Safe to spend",      value: formatUSD(result.safeToSpend),     sub: "After all deductions" },
            { label: "Emergency buffer",   value: formatUSD(result.emergencyBuffer), sub: "Protected, do not touch" },
            { label: "Bills before payday",value: formatUSD(result.billsDueSoon),    sub: "Already reserved" },
            { label: "Next paycheck",      value: nextPaycheck ?? "Not set",         sub: result.nextIncomeAmount > 0 ? `+${formatUSD(result.nextIncomeAmount)}` : "" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">{item.label}</p>
              <p className="mt-2 text-base font-semibold text-[var(--text-1)]">{item.value}</p>
              {item.sub && <p className="mt-0.5 text-xs text-[var(--text-3)]">{item.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

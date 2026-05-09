"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatUSDCents } from "@/lib/format";
type Verdict = "good" | "tight" | "over";
type Decision = {
  id: string;
  description: string;
  amount: number;
  verdict: string;
  reason: string | null;
  created_at: string;
};

interface Props {
  safeToSpend: number;
  weeklyNeedsTotal: number;
  recentDecisions: Decision[];
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "good") return <span className="text-xs font-semibold text-emerald-400">✓ Cleared</span>;
  if (verdict === "tight") return <span className="text-xs font-semibold text-amber-400">⚠ Tight</span>;
  return <span className="text-xs font-semibold text-red-400">✕ Not enough</span>;
}

export function DecisionHub({ safeToSpend, weeklyNeedsTotal, recentDecisions: initial }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictReason, setVerdictReason] = useState("");
  const [lukaLoading, setLukaLoading] = useState(false);
  const [lukaReply, setLukaReply] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function getVerdict(amt: number): { verdict: Verdict; reason: string } {
    if (amt <= safeToSpend) {
      return {
        verdict: "good",
        reason: `${formatUSDCents(safeToSpend - amt)} left after this purchase.`,
      };
    }
    if (amt <= safeToSpend + weeklyNeedsTotal) {
      return {
        verdict: "tight",
        reason: `Over safe-to-spend by ${formatUSDCents(amt - safeToSpend)} — dips into needs reserve.`,
      };
    }
    return {
      verdict: "over",
      reason: `Short ${formatUSDCents(amt - safeToSpend - weeklyNeedsTotal)} even across flex buckets.`,
    };
  }

  async function check() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !description.trim()) return;
    const { verdict: v, reason } = getVerdict(amt);
    setVerdict(v);
    setVerdictReason(reason);
    setLukaReply("");
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("spending_decisions")
        .insert({ user_id: user.id, description: description.trim(), amount: amt, verdict: v, reason })
        .select("id, description, amount, verdict, reason, created_at")
        .single();
      if (data) setDecisions((prev) => [data, ...prev].slice(0, 10));
    }
    setSaving(false);
  }

  const askLuka = useCallback(async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || !description.trim()) return;
    setLukaLoading(true);
    setLukaReply("");
    const prompt = `Should I spend ${formatUSDCents(amt)} on ${description.trim()}? My current safe-to-spend is ${formatUSDCents(safeToSpend)}.`;
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
  }, [amount, description, safeToSpend, router]);

  function reset() {
    setDescription("");
    setAmount("");
    setVerdict(null);
    setVerdictReason("");
    setLukaReply("");
  }

  const verdictColors = {
    good:  { border: "border-emerald-700/30", bg: "bg-emerald-900/10", text: "text-emerald-400" },
    tight: { border: "border-amber-700/30",   bg: "bg-amber-900/10",   text: "text-amber-400"   },
    over:  { border: "border-red-700/30",      bg: "bg-red-900/10",     text: "text-red-400"     },
  };

  return (
    <div className="mt-6 space-y-5">
      {/* ── Decide section ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Should I spend this?
          </p>
        </div>

        {verdict ? (
          <>
            {/* Verdict result */}
            <div className={`rounded-xl border p-4 ${verdictColors[verdict].border} ${verdictColors[verdict].bg}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-base font-bold ${verdictColors[verdict].text}`}>
                    {verdict === "good" ? "✓ You're clear." : verdict === "tight" ? "⚠ It's tight." : "✕ Not enough."}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-3)]">{verdictReason}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-3)]">
                    {description} · {formatUSDCents(parseFloat(amount))}
                  </p>
                </div>
                <button onClick={reset} className="ml-3 flex-shrink-0 text-[var(--text-3)] hover:text-[var(--text-1)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Ask Luka button */}
              {!lukaReply && (
                <button
                  onClick={askLuka}
                  disabled={lukaLoading}
                  className="mt-3 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50"
                  style={{
                    borderColor: "color-mix(in srgb, var(--luka) 30%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--luka) 8%, transparent)",
                    color: "var(--luka)",
                  }}
                >
                  {lukaLoading ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--luka)" }} />
                      Asking Luka…
                    </>
                  ) : (
                    <>
                      <span className="text-[10px]">✦</span> Get Luka&apos;s take
                    </>
                  )}
                </button>
              )}

              {lukaReply && (
                <div
                  className="mt-3 rounded-xl border px-4 py-3"
                  style={{
                    borderColor: "color-mix(in srgb, var(--luka) 20%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--luka) 6%, transparent)",
                  }}
                >
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--luka)" }}>Luka says</p>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{lukaReply}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you buying? (e.g. AirPods)"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-3)]">$</span>
                <input
                  type="number" inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && check()}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 pl-7 pr-4 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={check}
                disabled={!description.trim() || !amount || saving}
                className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Check
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Decision history ── */}
      {decisions.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Recent Decisions</p>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
            {decisions.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-1)] truncate">{d.description}</p>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    {new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {d.reason && ` · ${d.reason}`}
                  </p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-sm font-semibold text-[var(--text-1)]">{formatUSDCents(Number(d.amount))}</span>
                  <VerdictBadge verdict={d.verdict} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

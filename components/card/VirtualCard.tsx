"use client";

import { useRef, useState } from "react";
import { formatUSD } from "@/lib/format";

type Bucket = {
  label: string;
  amount: number;
  color: string;
  dotColor: string;
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
  const cardRef = useRef<HTMLDivElement>(null);

  const isNegative = safeToSpend <= 0;
  const amountColor = isNegative ? "#ff4560" : "#ffffff";

  // Card tilt on mousemove
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1000px) rotateX(${-y * 6}deg) rotateY(${x * 8}deg) translateZ(0)`;
  }
  function handleMouseLeave() {
    if (cardRef.current) cardRef.current.style.transform = "perspective(1000px) rotateX(0) rotateY(0)";
  }

  const buckets: Bucket[] = [
    { label: "Weekly needs reserve", amount: weeklyNeedsTotal,  color: "text-[var(--color-income)]",  dotColor: "bg-[#00d4aa]" },
    { label: "Bills reserved",       amount: billsDueSoon,      color: "text-[var(--color-warning)]", dotColor: "bg-[#ffaa00]" },
    { label: "Emergency buffer",     amount: emergencyBuffer,   color: "text-[var(--color-info)]",    dotColor: "bg-[#4da6ff]" },
    { label: "Giving set aside",     amount: givingDeducted,    color: "text-[var(--color-giving)]",  dotColor: "bg-[#d4a857]" },
    { label: "Savings set aside",    amount: savingsDeducted,   color: "text-[var(--color-income)]",  dotColor: "bg-[#00d4aa]" },
    ...(tradingDeducted > 0 ? [{ label: "Trading set aside", amount: tradingDeducted, color: "text-[var(--nova)]", dotColor: "bg-[#b57fff]" }] : []),
  ].filter((b) => b.amount > 0);

  function simulate() {
    const amt = parseFloat(purchaseAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (amt <= safeToSpend) {
      setVerdict("good");
      setVerdictDetail(`You're covered. ${formatUSD(safeToSpend - amt)} left after this.`);
    } else if (amt <= safeToSpend + weeklyNeedsTotal) {
      setVerdict("tight");
      setVerdictDetail(`Exceeds safe-to-spend by ${formatUSD(amt - safeToSpend)} — would dip into needs reserve.`);
    } else {
      setVerdict("over");
      setVerdictDetail(`Short ${formatUSD(amt - safeToSpend - weeklyNeedsTotal)} across all flex buckets.`);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Card visual ── */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "1.586 / 1",
          maxWidth: "380px",
          margin: "0 auto",
          transition: "transform 300ms ease",
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(120,87,255,0.45) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(85,56,232,0.35) 0%, transparent 50%),
            linear-gradient(135deg, #1a0a3d 0%, #0d0d1a 100%)
          `,
          boxShadow: "0 24px 60px rgba(120,87,255,0.3), 0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px",
          }}
        />

        {/* Glow orb */}
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col justify-between h-full p-6">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/50">Steward Money</p>
            </div>
            {/* Mastercard-style circles */}
            <div className="flex -space-x-3 items-center opacity-60">
              <div className="h-7 w-7 rounded-full bg-[#eb001b]/70" />
              <div className="h-7 w-7 rounded-full bg-[#f79e1b]/70" />
            </div>
          </div>

          {/* EMV Chip */}
          <div
            className="w-10 h-[30px] rounded-[4px]"
            style={{
              background: "linear-gradient(135deg, #c49a3c, #f0c870, #c49a3c)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap: "1px", padding: "3px" }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ background: "rgba(0,0,0,0.12)", borderRadius: "1px" }} />
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/70 mb-0.5">
                {displayName.split(" ")[0].toUpperCase()} {(displayName.split(" ")[1] ?? "").toUpperCase()}
              </p>
              <p className="font-mono text-[12px] tracking-[0.18em] text-white/40">•••• •••• •••• 0000</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-widest text-white/40 mb-0.5">Available</p>
              <p className="font-mono text-[22px] font-bold leading-none" style={{ color: amountColor, letterSpacing: "-0.03em" }}>
                {formatUSD(Math.max(0, safeToSpend))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bucket breakdown ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Protected buckets</p>
        <div className="divide-y divide-[var(--border-subtle)]">
          {buckets.length === 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--text-muted)]">No protected buckets set yet</span>
              <a href="/settings" className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity">Configure →</a>
            </div>
          )}
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span className={`h-1.5 w-1.5 rounded-full ${b.dotColor}`} />
                {b.label}
              </span>
              <span className={`font-mono text-sm font-semibold ${b.color}`}>{formatUSD(b.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-elevated)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">Total liquid</span>
            <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{formatUSD(liquidTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Spend simulator ── */}
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Spend simulator</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[var(--text-muted)] text-sm">$</span>
            <input
              type="number" inputMode="decimal"
              value={purchaseAmount}
              onChange={(e) => { setPurchaseAmount(e.target.value); setVerdict(null); setVerdictDetail(""); }}
              onKeyDown={(e) => e.key === "Enter" && simulate()}
              placeholder="How much?"
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-inset)] pl-7 pr-3 py-2.5 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={simulate}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-deep)] active:scale-[0.98] transition-all duration-150"
          >
            Check
          </button>
        </div>

        {verdict && (
          <div
            className="mt-3 rounded-xl border p-3"
            style={{
              borderColor: verdict === "good" ? "rgba(0,212,170,0.2)" : verdict === "tight" ? "rgba(255,170,0,0.2)" : "rgba(255,69,96,0.2)",
              background:  verdict === "good" ? "rgba(0,212,170,0.06)" : verdict === "tight" ? "rgba(255,170,0,0.06)" : "rgba(255,69,96,0.06)",
            }}
          >
            <p className="text-sm font-medium" style={{ color: verdict === "good" ? "var(--color-income)" : verdict === "tight" ? "var(--color-warning)" : "var(--color-danger)" }}>
              {verdict === "good" ? "✓ You're good." : verdict === "tight" ? "⚠ A little tight." : "✕ Not enough."}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{verdictDetail}</p>
            <button onClick={() => { setVerdict(null); setVerdictDetail(""); setPurchaseAmount(""); }} className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Reset
            </button>
          </div>
        )}
      </div>

      <p className="text-center font-mono text-[11px] text-[var(--text-dim)]">
        Physical card — coming soon. Spend only what&apos;s been cleared.
      </p>
    </div>
  );
}

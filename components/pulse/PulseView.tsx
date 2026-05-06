"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { formatUSD } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MannaData { dailyAllowance: number; spentToday: number; remaining: number }
interface WeeklyReport {
  solomon_word: string | null;
  stewardship_score: number | null;
  week_start: string;
  lived_within_provision: boolean | null;
  giving_honored: boolean | null;
}
interface Insight { id: string; insight_text: string; insight_type: string }
interface NovaMsg { id: string; message: string; trigger_type: string }
interface Alert { id: string; message: string; severity: string; alert_type: string }
interface KairosEvent { id: string; event_type: string; event_description: string }
interface Commitment { id: string; title: string; commitment_type: string; streak: number; adherenceRate: number | null }
interface EdenData { vision: string | null; moments: Array<{ id: string; content: string }> }

interface PulseData {
  manna: MannaData | null;
  solomonReport: WeeklyReport | null;
  solomonStrategy: string | null;
  silasInsights: Insight[];
  novaMessages: NovaMsg[];
  argusAlerts: Alert[];
  kairosEvents: KairosEvent[];
  ironCommitments: Commitment[];
  eden: EdenData | null;
  loading: boolean;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 10);
  const color = score >= 8 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="absolute -rotate-90" width="48" height="48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <section>
      <p className={`mb-2 text-[10px] font-semibold uppercase tracking-widest ${color}`}>{label}</p>
      {children}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PulseView() {
  const [data, setData] = useState<PulseData>({
    manna: null, solomonReport: null, solomonStrategy: null,
    silasInsights: [], novaMessages: [], argusAlerts: [],
    kairosEvents: [], ironCommitments: [], eden: null, loading: true,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [edenReflection, setEdenReflection] = useState<string | null>(null);
  const [edenReflecting, setEdenReflecting] = useState(false);

  const loadAll = useCallback(async () => {
    const [
      mannaRes, solomonLatestRes, strategyRes, silasRes,
      novaRes, argusRes, kairosRes, ironRes, edenRes,
    ] = await Promise.allSettled([
      fetch("/api/agents/manna").then((r) => r.json()),
      fetch("/api/agents/solomon/latest").then((r) => r.json()),
      fetch("/api/agents/solomon/strategy").then((r) => r.json()),
      fetch("/api/agents/silas").then((r) => r.json()),
      fetch("/api/agents/nova").then((r) => r.json()),
      fetch("/api/agents/argus/alerts").then((r) => r.json()),
      fetch("/api/agents/kairos").then((r) => r.json()),
      fetch("/api/agents/iron").then((r) => r.json()),
      fetch("/api/agents/eden").then((r) => r.json()),
    ]);

    setData({
      manna: mannaRes.status === "fulfilled" ? mannaRes.value : null,
      solomonReport: solomonLatestRes.status === "fulfilled" ? (solomonLatestRes.value.report ?? null) : null,
      solomonStrategy: strategyRes.status === "fulfilled" ? (strategyRes.value.strategy ?? null) : null,
      silasInsights: silasRes.status === "fulfilled" ? (silasRes.value.insights ?? []) : [],
      novaMessages: novaRes.status === "fulfilled" ? (novaRes.value.messages ?? []) : [],
      argusAlerts: argusRes.status === "fulfilled" ? (argusRes.value.alerts ?? []) : [],
      kairosEvents: kairosRes.status === "fulfilled" ? (kairosRes.value.events ?? []) : [],
      ironCommitments: ironRes.status === "fulfilled" ? (ironRes.value.commitments ?? []) : [],
      eden: edenRes.status === "fulfilled" ? edenRes.value : null,
      loading: false,
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.allSettled([
      fetch("/api/agents/argus", { method: "POST" }),
      fetch("/api/agents/silas", { method: "POST" }),
      fetch("/api/agents/solomon", { method: "POST" }),
    ]);
    await loadAll();
    setRefreshing(false);
  }

  async function dismissNovaMsg(id: string) {
    setData((prev) => ({ ...prev, novaMessages: prev.novaMessages.filter((m) => m.id !== id) }));
    await fetch("/api/agents/nova", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function dismissInsight(id: string) {
    const supabase = createClient();
    setData((prev) => ({ ...prev, silasInsights: prev.silasInsights.filter((i) => i.id !== id) }));
    await supabase.from("pulse_insights").update({ is_dismissed: true }).eq("id", id);
  }

  async function dismissAlert(id: string) {
    const supabase = createClient();
    setData((prev) => ({ ...prev, argusAlerts: prev.argusAlerts.filter((a) => a.id !== id) }));
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
  }

  async function acknowledgeKairos(id: string) {
    const supabase = createClient();
    setData((prev) => ({ ...prev, kairosEvents: prev.kairosEvents.filter((e) => e.id !== id) }));
    await supabase.from("life_events").update({ acknowledged: true }).eq("id", id);
  }

  async function getEdenReflection() {
    setEdenReflecting(true);
    try {
      const res = await fetch("/api/agents/eden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      setEdenReflection(d.reflection ?? null);
    } finally {
      setEdenReflecting(false);
    }
  }

  const { manna, solomonReport, solomonStrategy, silasInsights, novaMessages, argusAlerts, kairosEvents, ironCommitments, eden, loading } = data;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6 px-4 pb-10 pt-5 md:px-8 md:pt-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] pr-10 md:pr-0">Pulse</h1>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">Your financial reflection — refreshed daily</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">{today}</p>
          <button
            onClick={refreshAll}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] disabled:opacity-50"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Refreshing…" : "Refresh all"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 w-full rounded-xl bg-[var(--bg-elevated)] shimmer" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* 1. Manna */}
          {manna && manna.dailyAllowance > 0 && (
            <Section label="Manna · Today's Provision" color="text-amber-500">
              <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${manna.remaining <= 0 ? "text-red-400" : manna.remaining < manna.dailyAllowance * 0.25 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>
                      {formatUSD(manna.remaining)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">of {formatUSD(manna.dailyAllowance)} remaining today</p>
                  </div>
                  {manna.spentToday > 0 && (
                    <p className="text-sm text-[var(--text-muted)]">Spent: {formatUSD(manna.spentToday)}</p>
                  )}
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
                  <div
                    className={`h-1.5 rounded-full transition-all ${manna.remaining <= 0 ? "bg-red-500" : manna.remaining < manna.dailyAllowance * 0.25 ? "bg-amber-500" : "bg-amber-400"}`}
                    style={{ width: `${Math.max(0, Math.min(100, manna.dailyAllowance > 0 ? (manna.remaining / manna.dailyAllowance) * 100 : 0))}%` }}
                  />
                </div>
              </div>
            </Section>
          )}

          {/* 2. Solomon's Word */}
          {solomonReport?.solomon_word && (
            <Section label="Solomon's Word" color="text-amber-600">
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AgentAvatar agent="solomon" size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{solomonReport.solomon_word}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                      {solomonReport.lived_within_provision != null && (
                        <span className={solomonReport.lived_within_provision ? "text-green-500" : "text-red-400"}>
                          {solomonReport.lived_within_provision ? "✓ Lived within provision" : "✕ Exceeded provision"}
                        </span>
                      )}
                      {solomonReport.giving_honored != null && (
                        <span className={solomonReport.giving_honored ? "text-green-500" : "text-amber-400"}>
                          {solomonReport.giving_honored ? "✓ Giving honored" : "· Giving not recorded"}
                        </span>
                      )}
                    </div>
                  </div>
                  {solomonReport.stewardship_score != null && (
                    <ScoreRing score={solomonReport.stewardship_score} />
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* 3. Solomon's Strategy */}
          {solomonStrategy && (
            <Section label="Solomon's Strategy" color="text-amber-600">
              <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4">
                <div className="flex items-start gap-3">
                  <AgentAvatar agent="solomon" size="sm" />
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{solomonStrategy}</p>
                </div>
              </div>
            </Section>
          )}

          {/* 4. Eden's Vision */}
          {eden && (
            <Section label="Eden · Vision" color="text-pink-400">
              <div className="rounded-xl border border-pink-900/30 bg-pink-950/10 p-4">
                {eden.vision && (
                  <p className="text-xs text-[var(--text-muted)] italic mb-3">&ldquo;{eden.vision}&rdquo;</p>
                )}
                {edenReflection ? (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{edenReflection}</p>
                ) : (
                  <button
                    onClick={getEdenReflection}
                    disabled={edenReflecting}
                    className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    {edenReflecting ? "Reflecting…" : "Get today's reflection →"}
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* 5. Silas Insights */}
          {silasInsights.length > 0 && (
            <Section label="Silas Sees" color="text-teal-500">
              <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-subtle)]">
                {silasInsights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="flex items-start gap-3 px-4 py-3.5">
                    <AgentAvatar agent="silas" size="sm" />
                    <p className="flex-1 text-sm text-[var(--text-secondary)] leading-relaxed">{insight.insight_text}</p>
                    <button
                      onClick={() => dismissInsight(insight.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-base leading-none mt-0.5 shrink-0"
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 6. Iron's Commitments */}
          {ironCommitments.length > 0 && (
            <Section label="Iron · Commitments" color="text-orange-400">
              <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-subtle)]">
                {ironCommitments.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{c.title}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">{c.commitment_type}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {c.streak > 0 && (
                        <p className="text-xs font-medium text-orange-400">{c.streak} streak</p>
                      )}
                      {c.adherenceRate != null && (
                        <p className="text-xs text-[var(--text-muted)]">{c.adherenceRate}%</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 7. Nova Messages */}
          {novaMessages.length > 0 && (
            <Section label="Nova · Future Self" color="text-violet-400">
              <div className="space-y-2">
                {novaMessages.map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-violet-900/30 bg-violet-950/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{msg.message}</p>
                      <button onClick={() => dismissNovaMsg(msg.id)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-base leading-none shrink-0">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 8. Argus Alerts */}
          {argusAlerts.length > 0 && (
            <Section label="Argus · Alerts" color="text-blue-400">
              <div className="space-y-2">
                {argusAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 ${
                      alert.severity === "danger"
                        ? "border-red-900/50 bg-red-950/30 text-red-300"
                        : alert.severity === "info"
                        ? "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                        : "border-amber-900/50 bg-amber-950/30 text-amber-300"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{alert.message}</p>
                    <button onClick={() => dismissAlert(alert.id)} className="text-current opacity-50 hover:opacity-80 transition-opacity text-base leading-none shrink-0">×</button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 9. Kairos Life Events */}
          {kairosEvents.length > 0 && (
            <Section label="Kairos · Life Changes" color="text-green-400">
              <div className="space-y-2">
                {kairosEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-green-900/30 bg-green-950/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-green-500 mb-1">{event.event_type.replace(/_/g, " ")}</p>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{event.event_description}</p>
                      </div>
                      <button
                        onClick={() => acknowledgeKairos(event.id)}
                        className="shrink-0 rounded-lg border border-green-900/40 px-3 py-1.5 text-xs text-green-400 hover:bg-green-950/30 transition-colors"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Empty state */}
          {!manna && !solomonReport && silasInsights.length === 0 && novaMessages.length === 0 && argusAlerts.length === 0 && kairosEvents.length === 0 && ironCommitments.length === 0 && !eden && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">All quiet. Your agents are watching over your finances.</p>
              <button onClick={refreshAll} className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">Run agents now →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

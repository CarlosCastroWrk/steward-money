"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentChatModal } from "./AgentChatModal";
import { TabPills } from "@/components/ui/TabPills";
import { createClient } from "@/lib/supabase/client";
import { formatUSD } from "@/lib/format";

type AgentName = "argus" | "iron" | "manna" | "nova" | "eden" | "solomon" | "silas" | "echo" | "kairos";
type DateFilter = "today" | "week" | "all";

interface FeedItem {
  id: string;
  agent: AgentName;
  headline: string;
  detail: string;
  priority: number; // lower = higher priority
  createdAt: string;
  context: string; // passed to chat for rich context
  onDismiss?: () => void;
}

// Agent brand colors for left border accent
const AGENT_COLOR: Record<AgentName, string> = {
  argus:   "#4da6ff",
  iron:    "#ff6b8a",
  manna:   "#ffcc44",
  nova:    "#b57fff",
  eden:    "#ff6bda",
  solomon: "#d4a857",
  silas:   "#00d4aa",
  echo:    "#8899aa",
  kairos:  "#00ff87",
};

const AGENT_NAMES: Record<AgentName, string> = {
  argus:   "Argus",
  iron:    "Iron",
  manna:   "Manna",
  nova:    "Nova",
  eden:    "Eden",
  solomon: "Solomon",
  silas:   "Silas",
  echo:    "Echo",
  kairos:  "Kairos",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isWithin(iso: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const diff = Date.now() - new Date(iso).getTime();
  if (filter === "today") return diff < 86_400_000;
  if (filter === "week") return diff < 7 * 86_400_000;
  return true;
}

// ─── Individual card ──────────────────────────────────────────────────────────

function InsightCard({ item, onTap, index }: { item: FeedItem; onTap: (item: FeedItem) => void; index: number }) {
  const color = AGENT_COLOR[item.agent];
  return (
    <button
      type="button"
      onClick={() => onTap(item)}
      className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden transition-all duration-150 active:scale-[0.98] hover:border-[var(--border-strong)] hover:shadow-sm"
      style={{
        animationDelay: `${index * 50}ms`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <AgentAvatar agent={item.agent} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold" style={{ color }}>{AGENT_NAMES[item.agent]}</span>
              <span className="text-[10px] text-[var(--text-3)]">{timeAgo(item.createdAt)}</span>
            </div>
            <p className="text-sm font-medium text-[var(--text-1)] leading-snug">{item.headline}</p>
            {item.detail && (
              <p className="mt-1 text-xs text-[var(--text-2)] leading-relaxed line-clamp-2">{item.detail}</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-right text-[10px] text-[var(--text-3)]">Tap to discuss →</p>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PulseView() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DateFilter>("all");
  const [chatItem, setChatItem] = useState<FeedItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const now = new Date().toISOString();
    const items: FeedItem[] = [];

    const [
      argusRes,
      ironRes,
      mannaRes,
      novaRes,
      edenRes,
      solomonRes,
      silasRes,
      kairosRes,
    ] = await Promise.allSettled([
      fetch("/api/agents/argus/alerts").then((r) => r.json()),
      fetch("/api/agents/iron").then((r) => r.json()),
      fetch("/api/agents/manna").then((r) => r.json()),
      fetch("/api/agents/nova").then((r) => r.json()),
      fetch("/api/agents/eden").then((r) => r.json()),
      fetch("/api/agents/solomon/latest").then((r) => r.json()),
      fetch("/api/agents/silas").then((r) => r.json()),
      fetch("/api/agents/kairos").then((r) => r.json()),
    ]);

    // 1. Argus alerts — priority 1
    if (argusRes.status === "fulfilled") {
      const alerts: Array<{ id: string; message: string; severity: string; alert_type: string; created_at?: string }> = argusRes.value.alerts ?? [];
      alerts.slice(0, 4).forEach((alert) => {
        const urgency = alert.severity === "danger" ? "🔴" : alert.severity === "warning" ? "⚠️" : "ℹ️";
        items.push({
          id: `argus-${alert.id}`,
          agent: "argus",
          headline: `${urgency} ${alert.message}`,
          detail: `Severity: ${alert.severity} · Type: ${alert.alert_type.replace(/_/g, " ")}`,
          priority: alert.severity === "danger" ? 1 : alert.severity === "warning" ? 2 : 3,
          createdAt: alert.created_at ?? now,
          context: `Financial alert — ${alert.severity} severity. Alert type: ${alert.alert_type}. Message: ${alert.message}`,
          onDismiss: async () => {
            const supabase = createClient();
            await supabase.from("alerts").update({ is_read: true }).eq("id", alert.id);
            setFeed((prev) => prev.filter((i) => i.id !== `argus-${alert.id}`));
          },
        });
      });
    }

    // 2. Iron commitments — priority 10
    if (ironRes.status === "fulfilled") {
      const commitments: Array<{ id: string; title: string; commitment_type: string; streak: number; adherenceRate?: number }> = ironRes.value.commitments ?? [];
      commitments.slice(0, 3).forEach((c) => {
        const streakText = c.streak > 0 ? `${c.streak}-day streak.` : "No active streak yet.";
        items.push({
          id: `iron-${c.id}`,
          agent: "iron",
          headline: c.title,
          detail: `${c.commitment_type} commitment · ${streakText}${c.adherenceRate != null ? ` ${c.adherenceRate}% adherence rate.` : ""}`,
          priority: 10,
          createdAt: now,
          context: `Commitment: "${c.title}" · Type: ${c.commitment_type} · Streak: ${c.streak} days · Adherence: ${c.adherenceRate ?? "unknown"}%`,
        });
      });
    }

    // 3. Manna — priority 20
    if (mannaRes.status === "fulfilled") {
      const manna = mannaRes.value;
      if (manna && manna.hasPaycheckDate && !manna.isNegative) {
        const eventHint = manna.nextBigEvent
          ? ` · Saving for ${manna.nextBigEvent.title ?? "upcoming event"} ($${(manna.nextBigEvent.estimate ?? 0).toFixed(0)} est.)`
          : "";
        const effectiveAllowance = manna.adjustedDailyAllowance ?? manna.dailyAllowance;
        items.push({
          id: "manna-today",
          agent: "manna",
          headline: `${formatUSD(effectiveAllowance)} for today${manna.nextBigEvent ? ` (adjusted for upcoming event)` : ""}`,
          detail: `Base allowance: ${formatUSD(manna.dailyAllowance)}${eventHint}${manna.spentToday > 0 ? ` · Spent: ${formatUSD(manna.spentToday)}` : ""}`,
          priority: 20,
          createdAt: now,
          context: `Today's provision. Daily allowance: ${formatUSD(manna.dailyAllowance)}. Adjusted: ${formatUSD(effectiveAllowance)}. Spent today: ${formatUSD(manna.spentToday)}. Days until next paycheck: ${manna.daysUntilPaycheck ?? "unknown"}.${manna.upcomingEventCost > 0 ? ` Upcoming event costs in next 14 days: $${manna.upcomingEventCost.toFixed(0)}.` : ""}`,
        });
      } else if (manna?.isNegative) {
        items.push({
          id: "manna-negative",
          agent: "manna",
          headline: "Focus on stability today",
          detail: "Safe-to-spend is currently negative. No daily allowance until balance improves.",
          priority: 5,
          createdAt: now,
          context: "User's safe-to-spend is negative. The balance is below zero after all deductions.",
        });
      }
    }

    // 4. Nova messages — priority 30
    if (novaRes.status === "fulfilled") {
      const messages: Array<{ id: string; message: string; trigger_type: string; created_at?: string }> = novaRes.value.messages ?? [];
      messages.slice(0, 2).forEach((msg) => {
        items.push({
          id: `nova-${msg.id}`,
          agent: "nova",
          headline: msg.message,
          detail: `Foresight · ${msg.trigger_type.replace(/_/g, " ")}`,
          priority: 30,
          createdAt: msg.created_at ?? now,
          context: `Financial foresight message. Trigger: ${msg.trigger_type}. Message: ${msg.message}`,
          onDismiss: async () => {
            await fetch("/api/agents/nova", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: msg.id }),
            });
            setFeed((prev) => prev.filter((i) => i.id !== `nova-${msg.id}`));
          },
        });
      });
    }

    // 5. Eden vision moments — priority 40
    if (edenRes.status === "fulfilled") {
      const eden = edenRes.value;
      if (eden?.vision) {
        items.push({
          id: "eden-vision",
          agent: "eden",
          headline: "Reflect on your vision",
          detail: `"${eden.vision}"`,
          priority: 40,
          createdAt: now,
          context: `User's personal vision: "${eden.vision}". This is their long-term life vision that should inform financial decisions.`,
        });
      }
    }

    // 6. Solomon weekly wisdom — priority 50
    if (solomonRes.status === "fulfilled") {
      const report = solomonRes.value.report;
      if (report?.solomon_word) {
        const scoreText = report.stewardship_score != null ? ` Stewardship score: ${report.stewardship_score}/10.` : "";
        items.push({
          id: `solomon-${report.week_start ?? "week"}`,
          agent: "solomon",
          headline: report.solomon_word.slice(0, 120) + (report.solomon_word.length > 120 ? "…" : ""),
          detail: `Week of ${report.week_start ?? "this week"}${scoreText}`,
          priority: 50,
          createdAt: report.week_start ? new Date(report.week_start).toISOString() : now,
          context: `Solomon's weekly word: "${report.solomon_word}" · Stewardship score: ${report.stewardship_score ?? "not set"}/10 · Lived within provision: ${report.lived_within_provision} · Giving honored: ${report.giving_honored}`,
        });
      }
    }

    // 7. Silas behavioral insights — priority 60
    if (silasRes.status === "fulfilled") {
      const insights: Array<{ id: string; insight_text: string; insight_type: string; created_at?: string }> = silasRes.value.insights ?? [];
      insights.slice(0, 3).forEach((insight) => {
        items.push({
          id: `silas-${insight.id}`,
          agent: "silas",
          headline: insight.insight_text,
          detail: `Pattern type: ${insight.insight_type.replace(/_/g, " ")}`,
          priority: 60,
          createdAt: insight.created_at ?? now,
          context: `Behavioral pattern observed. Type: ${insight.insight_type}. Insight: "${insight.insight_text}"`,
          onDismiss: async () => {
            const supabase = createClient();
            await supabase.from("pulse_insights").update({ is_dismissed: true }).eq("id", insight.id);
            setFeed((prev) => prev.filter((i) => i.id !== `silas-${insight.id}`));
          },
        });
      });
    }

    // 9. Kairos — life events + calendar insights — priority 70
    if (kairosRes.status === "fulfilled") {
      // Life events from DB
      const events: Array<{ id: string; event_type: string; event_description: string; created_at?: string }> = kairosRes.value.events ?? [];
      events.forEach((ev) => {
        items.push({
          id: `kairos-${ev.id}`,
          agent: "kairos",
          headline: ev.event_description,
          detail: `Life event: ${ev.event_type.replace(/_/g, " ")}`,
          priority: 70,
          createdAt: ev.created_at ?? now,
          context: `Life transition event. Type: ${ev.event_type}. Description: "${ev.event_description}"`,
          onDismiss: async () => {
            const supabase = createClient();
            await supabase.from("life_events").update({ acknowledged: true }).eq("id", ev.id);
            setFeed((prev) => prev.filter((i) => i.id !== `kairos-${ev.id}`));
          },
        });
      });

      // Calendar-based insights from Kairos — shown at higher priority (15) since they're time-sensitive
      const calendarInsights: Array<{ id: string; type: string; headline: string; detail: string; event_date: string; spending_estimate: number }> = kairosRes.value.calendar_insights ?? [];
      calendarInsights.forEach((insight) => {
        items.push({
          id: insight.id,
          agent: "kairos",
          headline: insight.headline,
          detail: insight.detail,
          priority: insight.spending_estimate >= 200 ? 8 : 15, // expensive events near Argus in priority
          createdAt: insight.event_date,
          context: `Calendar event coming up. Type: ${insight.type}. ${insight.detail} Estimated cost: $${insight.spending_estimate}.`,
        });
      });
    }

    // Sort by priority then by date (most recent first within same priority)
    items.sort((a, b) => a.priority - b.priority || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFeed(items);
    setLoading(false);
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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const visible = feed.filter((item) => isWithin(item.createdAt, filter));

  return (
    <>
      <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-1)] pr-10 md:pr-0">Pulse</h1>
          <p className="mt-0.5 text-sm text-[var(--text-2)]">What your agents are noticing</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-[var(--text-3)]">{today}</p>
            <button
              onClick={refreshAll}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--text-2)] transition-all hover:border-[var(--border-strong)] disabled:opacity-50"
            >
              <svg className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Date filter as pills */}
        <TabPills
          tabs={[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "all", label: "All" },
          ]}
          active={filter}
          onChange={(id) => setFilter(id as DateFilter)}
        />

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 w-full rounded-2xl bg-[var(--bg-elevated)] shimmer" />
            ))}
          </div>
        )}

        {/* Feed */}
        {!loading && visible.length > 0 && (
          <div className="space-y-3">
            {visible.map((item, index) => (
              <InsightCard key={item.id} item={item} onTap={setChatItem} index={index} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-3)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--text-2)]">
              {filter !== "all" ? "No insights in this time range." : "Your agents are still learning your patterns."}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              {filter !== "all" ? (
                <button onClick={() => setFilter("all")} className="text-[var(--accent)] hover:opacity-80">View all time →</button>
              ) : "Check back tomorrow."}
            </p>
          </div>
        )}
      </div>

      {/* Agent chat overlay */}
      {chatItem && (
        <AgentChatModal
          agent={chatItem.agent}
          initialMessage={chatItem.headline}
          context={chatItem.context}
          onClose={() => setChatItem(null)}
        />
      )}
    </>
  );
}

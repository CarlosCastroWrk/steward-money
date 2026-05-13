"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";
import { AgentChat } from "@/components/agents/AgentChat";

const VALID_AGENTS = Object.keys(AGENT_REGISTRY) as AgentName[];
const ARCHIVED_AGENTS = ["argus", "silas", "manna", "eden", "nova"] as const;
type ArchivedAgent = typeof ARCHIVED_AGENTS[number];

const PLACEHOLDERS: Partial<Record<AgentName, string>> = {
  luka:    "I'll surface what needs your attention.",
  solomon: "Wisdom on Sundays.",
  kairos:  "Reading your time.",
  iron:    "I'll hold you to your commitments.",
  echo:    "I remember what matters.",
};

type Tab = "insight" | "chat";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface InsightRow {
  content: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function AgentDetailPage() {
  const { agent_name } = useParams() as { agent_name: string };
  const router = useRouter();
  const agent = VALID_AGENTS.includes(agent_name as AgentName) ? (agent_name as AgentName) : null;
  const config = agent ? AGENT_REGISTRY[agent] : null;

  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [history, setHistory] = useState<ConversationMessage[] | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("insight");
  const [insightIdx, setInsightIdx] = useState(0);
  const cleared = useRef(false);

  const load = useCallback(async () => {
    if (!agent) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!cleared.current) {
      cleared.current = true;
      supabase
        .from("agent_unread_counts")
        .upsert({ user_id: user.id, agent_name: agent, unread_count: 0 }, { onConflict: "user_id,agent_name" })
        .then(() => {});
    }

    const { data } = await supabase
      .from("agent_conversations")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .eq("agent_name", agent)
      .order("created_at", { ascending: false })
      .limit(40);

    const rows = ((data ?? []) as ConversationMessage[]).reverse();
    setHistory(rows);

    const assistantRows = rows.filter((r) => r.role === "assistant").slice(-3).reverse();
    setInsights(assistantRows);
  }, [agent]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!menuOpen) return;
    function close() { setMenuOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  if (ARCHIVED_AGENTS.includes(agent_name as ArchivedAgent)) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]" style={{ height: "100dvh" }}>
        <div style={{ height: 3, backgroundColor: "var(--border)", flexShrink: 0 }} />
        <div
          className="flex-shrink-0 flex items-center bg-[var(--bg-card)] border-b border-[var(--border)] px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
        >
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-lg font-semibold text-[var(--text-1)] capitalize mb-2">{agent_name}</p>
          <p className="text-sm text-[var(--text-3)] leading-relaxed">
            This adviser has been retired. Your council is now Luka, Solomon, Kairos, Iron, and Echo.
          </p>
        </div>
      </div>
    );
  }

  if (!agent || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-3)] text-sm">Agent not found.</p>
      </div>
    );
  }

  const isSerif = config.fontTreatment === "serif";
  const currentInsight = insights[insightIdx] ?? null;

  // Loading skeleton
  if (history === null) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]" style={{ height: "100dvh" }}>
        <div style={{ backgroundColor: config.color, height: 3, flexShrink: 0 }} />
        <div
          className="flex-shrink-0 flex items-center justify-between bg-[var(--bg-card)] border-b border-[var(--border)] px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
        >
          <div className="h-9 w-9 shimmer rounded-xl" />
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-3.5 w-20 shimmer rounded" />
            <div className="h-2.5 w-28 shimmer rounded" />
          </div>
          <div className="h-9 w-9 shimmer rounded-xl" />
        </div>
        <div className="flex-1 px-5 py-8 space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-40 shimmer rounded" />
            <div className="h-3 w-28 shimmer rounded" />
          </div>
          <div className="pl-4 border-l-2 space-y-2" style={{ borderColor: config.color + "40" }}>
            <div className="h-3.5 w-full shimmer rounded" />
            <div className="h-3.5 w-5/6 shimmer rounded" />
            <div className="h-3.5 w-4/6 shimmer rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]" style={{ height: "100dvh" }}>

      {/* ── Color accent strip ──────────────────────────────────────────── */}
      <div style={{ backgroundColor: config.color, height: 3, flexShrink: 0 }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between bg-[var(--bg-card)] border-b border-[var(--border)] px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
      >
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Back"
          style={{ color: config.color }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Tab toggle */}
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
          {(["insight", "chat"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 text-xs font-semibold capitalize transition-colors"
              style={
                activeTab === tab
                  ? { backgroundColor: config.color, color: "#fff" }
                  : { color: "var(--text-3)" }
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* More menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] transition-colors"
            aria-label="More"
          >
            <Dots />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => { setChatKey((k) => k + 1); setActiveTab("chat"); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-[var(--text-1)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Plus /> New chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Insight view ────────────────────────────────────────────────── */}
      {activeTab === "insight" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-8 pb-10 max-w-lg mx-auto">

            {/* Agent hero */}
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-1.5">
                <p
                  className={`text-3xl font-bold tracking-tight ${isSerif ? "font-serif" : ""}`}
                  style={{ color: config.color }}
                >
                  {config.name}
                </p>
                <span
                  className="text-[10px] font-semibold tracking-widest px-2 py-0.5 rounded-full border"
                  style={{
                    color: config.color,
                    borderColor: config.color + "50",
                    backgroundColor: config.color + "12",
                  }}
                >
                  • {config.role.split(" ").slice(0, 2).join(" ").toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-[var(--text-3)]">{config.subtitle}</p>
            </div>

            {/* Insight blockquote */}
            <div className="mb-5">
              <div
                className="pl-4 py-0.5 border-l-[3px] mb-3"
                style={{ borderColor: config.color }}
              >
                {currentInsight ? (
                  <p
                    className={`text-[15px] leading-relaxed text-[var(--text-1)] ${isSerif ? "italic" : ""}`}
                    style={isSerif ? { fontFamily: "Georgia, serif" } : {}}
                  >
                    {currentInsight.content}
                  </p>
                ) : (
                  <p className="text-sm italic text-[var(--text-3)]">
                    {PLACEHOLDERS[agent] ?? "Tap to start a conversation."}
                  </p>
                )}
              </div>
              {currentInsight && (
                <p className="text-[11px] text-[var(--text-3)] pl-4">{timeAgo(currentInsight.created_at)}</p>
              )}
            </div>

            {/* Time chips */}
            {insights.length > 1 && (
              <div className="flex gap-2 flex-wrap mb-10">
                {insights.map((ins, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInsightIdx(i)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={
                      i === insightIdx
                        ? { backgroundColor: config.color, color: "#fff" }
                        : { backgroundColor: "var(--bg-elevated)", color: "var(--text-3)" }
                    }
                  >
                    {i === 0 ? "Latest" : timeAgo(ins.created_at)}
                  </button>
                ))}
              </div>
            )}

            {/* Chat CTA */}
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: config.color }}
            >
              Chat with {config.name}
            </button>
          </div>
        </div>
      )}

      {/* ── Chat view ───────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <AgentChat
          key={chatKey}
          agent={agent}
          embedded
          initialMessages={[]}
          onClose={() => router.back()}
        />
      )}
    </div>
  );
}

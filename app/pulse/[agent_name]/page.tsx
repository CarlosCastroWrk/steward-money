"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";
import { AgentChat } from "@/components/agents/AgentChat";

const VALID_AGENTS = Object.keys(AGENT_REGISTRY) as AgentName[];

const PLACEHOLDERS: Record<AgentName, string> = {
  luka:    "I'll surface what needs your attention.",
  solomon: "Wisdom on Sundays.",
  kairos:  "Reading your time.",
  argus:   "Watching the numbers.",
  iron:    "I'll hold you to your commitments.",
  manna:   "Today is enough.",
  eden:    "What does abundance look like for you?",
  nova:    "Looking ahead so you don't have to.",
  echo:    "I remember what matters.",
  silas:   "I notice patterns.",
};

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
  return `${Math.floor(h / 24)}d ago`;
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
  const cleared = useRef(false);

  const load = useCallback(async () => {
    if (!agent) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Clear unread count
    if (!cleared.current) {
      cleared.current = true;
      supabase
        .from("agent_unread_counts")
        .upsert({ user_id: user.id, agent_name: agent, unread_count: 0 }, { onConflict: "user_id,agent_name" })
        .then(() => {});
    }

    // Load conversation history (last 40 messages for chat context, ascending)
    const { data } = await supabase
      .from("agent_conversations")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .eq("agent_name", agent)
      .order("created_at", { ascending: false })
      .limit(40);

    const rows = ((data ?? []) as ConversationMessage[]).reverse();
    setHistory(rows);

    // Latest 3 assistant messages for insights section
    const assistantRows = rows.filter((r) => r.role === "assistant").slice(-3).reverse();
    setInsights(assistantRows);
  }, [agent]);

  useEffect(() => { load(); }, [load]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function close() { setMenuOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  if (!agent || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-3)] text-sm">Agent not found.</p>
      </div>
    );
  }

  const initialMessages = history ?? [];

  // Loading skeleton — shown while history fetches
  if (history === null) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]">
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
        <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 space-y-3">
          <div className="h-2 w-32 shimmer rounded" />
          <div className="space-y-1.5">
            <div className="h-3 w-full shimmer rounded" />
            <div className="h-3 w-4/5 shimmer rounded" />
            <div className="h-2.5 w-16 shimmer rounded mt-1" />
          </div>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]">

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
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Back"
          style={{ color: config.color }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Agent name + role */}
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--text-1)]">{config.name}</p>
          <p className="text-[11px] text-[var(--text-3)]">{config.role}</p>
        </div>

        {/* More menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
            aria-label="More"
          >
            <Dots />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => { setChatKey((k) => k + 1); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-[var(--text-1)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Plus /> New chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Insights strip ──────────────────────────────────────────────── */}
      {history !== null && (
        <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2">
              Latest from {config.name}
            </p>
            {insights.length === 0 ? (
              <p className="text-sm text-[var(--text-3)] italic">{PLACEHOLDERS[agent]}</p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((ins, i) => (
                  <div key={i}>
                    <p className="text-sm text-[var(--text-1)] leading-snug line-clamp-3">{ins.content}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{timeAgo(ins.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Embedded chat ───────────────────────────────────────────────── */}
      {history !== null && (
        <AgentChat
          key={chatKey}
          agent={agent}
          embedded
          initialMessages={initialMessages}
          onClose={() => router.back()}
        />
      )}
    </div>
  );
}

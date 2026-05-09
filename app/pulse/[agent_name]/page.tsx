"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";
import { AgentChat } from "@/components/agents/AgentChat";

const VALID_AGENTS = Object.keys(AGENT_REGISTRY) as AgentName[];

export default function AgentDetailPage() {
  const { agent_name } = useParams() as { agent_name: string };
  const router = useRouter();
  const agent = VALID_AGENTS.includes(agent_name as AgentName) ? (agent_name as AgentName) : null;

  const [chatOpen, setChatOpen] = useState(false);
  const [lastMsg, setLastMsg] = useState<{ content: string; created_at: string } | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const cleared = useRef(false);

  const config = agent ? AGENT_REGISTRY[agent] : null;

  // Clear unread count on mount
  useEffect(() => {
    if (!agent || cleared.current) return;
    cleared.current = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("agent_unread_counts")
        .upsert({ user_id: user.id, agent_name: agent, unread_count: 0 }, { onConflict: "user_id,agent_name" })
        .then(() => {});
    });
  }, [agent]);

  // Fetch last assistant message from this agent
  useEffect(() => {
    if (!agent) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("agent_conversations")
        .select("content, created_at")
        .eq("user_id", user.id)
        .eq("agent_name", agent)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setLastMsg(data);
          setLoadingMsg(false);
        });
    });
  }, [agent]);

  if (!agent || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-3)] text-sm">Agent not found.</p>
      </div>
    );
  }

  if (chatOpen) {
    return (
      <AgentChat
        agent={agent}
        onClose={() => setChatOpen(false)}
      />
    );
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pb-4 bg-[var(--bg-card)] border-b border-[var(--border)]"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          className="h-10 w-10 flex items-center justify-center rounded-full text-base font-bold text-white flex-shrink-0"
          style={{ backgroundColor: config.color, boxShadow: `0 0 16px ${config.color}33` }}
        >
          {config.name[0]}
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--text-1)]">{config.name}</p>
          <p className="text-xs text-[var(--text-3)]">{config.role}</p>
        </div>
      </div>

      <div className="px-4 pb-10 pt-6 max-w-lg space-y-5">

        {/* Latest message */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-1">
            Latest from {config.name}
          </p>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            {loadingMsg && (
              <div className="h-12 rounded-xl bg-[var(--bg-elevated)] shimmer" />
            )}
            {!loadingMsg && lastMsg && (
              <>
                <p className="text-sm text-[var(--text-1)] leading-relaxed">{lastMsg.content}</p>
                <p className="mt-2 text-[11px] text-[var(--text-3)]">{timeAgo(lastMsg.created_at)}</p>
              </>
            )}
            {!loadingMsg && !lastMsg && (
              <p className="text-sm text-[var(--text-3)]">
                {config.name} hasn&apos;t reached out lately. Start a conversation?
              </p>
            )}
          </div>
        </div>

        {/* Talk button */}
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="w-full rounded-2xl py-4 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:opacity-90"
          style={{ backgroundColor: config.color }}
        >
          Talk to {config.name}
        </button>

        {/* Agent description */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2">What {config.name} does</p>
          <p className="text-sm text-[var(--text-2)] leading-relaxed">{config.prompt}</p>
        </div>
      </div>
    </div>
  );
}

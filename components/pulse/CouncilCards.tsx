"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";

const AGENT_ORDER: AgentName[] = [
  "luka", "solomon", "kairos", "argus", "iron",
  "manna", "eden", "nova", "echo", "silas",
];

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

interface LastMessage {
  content: string;
  created_at: string;
}

interface UnreadMap {
  [agent: string]: number;
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

function AgentCard({
  agent,
  unread,
  lastMsg,
  index,
  onTap,
}: {
  agent: AgentName;
  unread: number;
  lastMsg: LastMessage | null;
  index: number;
  onTap: () => void;
}) {
  const config = AGENT_REGISTRY[agent];
  const [pressing, setPressing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 55);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <button
      type="button"
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => { setPressing(false); onTap(); }}
      onPointerLeave={() => setPressing(false)}
      className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? pressing ? "scale(0.98)" : "scale(1)"
          : "translateY(8px) scale(0.99)",
        transitionDelay: visible ? "0ms" : `${index * 55}ms`,
        borderLeft: `3px solid ${config.color}`,
      }}
    >
      <div className="px-4 py-4">
        {/* Row 1: name + role + badge + chevron */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-1)]">{config.name}</span>
          <span className="text-xs text-[var(--text-3)] truncate flex-1 min-w-0">{config.role}</span>
          {unread > 0 && (
            <span
              className="flex-shrink-0 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: config.color }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0 text-[var(--text-3)]">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* Row 2: latest insight preview */}
        <p className={`mt-2 text-sm leading-snug line-clamp-2 ${lastMsg ? "text-[var(--text-2)]" : "text-[var(--text-3)] italic"}`}>
          {lastMsg ? lastMsg.content : PLACEHOLDERS[agent]}
        </p>

        {/* Row 3: footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-3)]">
            {lastMsg ? timeAgo(lastMsg.created_at) : "Tap to start"}
          </span>
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: config.color }}
          />
        </div>
      </div>
    </button>
  );
}

export function CouncilCards() {
  const router = useRouter();
  const [unreads, setUnreads] = useState<UnreadMap>({});
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      Promise.all([
        supabase
          .from("agent_unread_counts")
          .select("agent_name, unread_count")
          .eq("user_id", user.id),
        supabase
          .from("agent_conversations")
          .select("agent_name, content, created_at")
          .eq("user_id", user.id)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
          .limit(50),
      ]).then(([unreadRes, msgsRes]) => {
        const um: UnreadMap = {};
        (unreadRes.data ?? []).forEach((row) => { um[row.agent_name] = row.unread_count; });
        setUnreads(um);

        const lm: Record<string, LastMessage> = {};
        (msgsRes.data ?? []).forEach((row) => {
          if (!lm[row.agent_name]) {
            lm[row.agent_name] = { content: row.content, created_at: row.created_at };
          }
        });
        setLastMessages(lm);
      });
    });
  }, []);

  return (
    <div className="space-y-3">
      {AGENT_ORDER.map((agent, i) => (
        <AgentCard
          key={agent}
          agent={agent}
          unread={unreads[agent] ?? 0}
          lastMsg={lastMessages[agent] ?? null}
          index={i}
          onTap={() => router.push(`/pulse/${agent}`)}
        />
      ))}
    </div>
  );
}

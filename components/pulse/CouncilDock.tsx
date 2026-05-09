"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";

const AGENT_ORDER: AgentName[] = [
  "luka", "solomon", "kairos", "argus", "iron",
  "manna", "eden", "nova", "echo", "silas",
];

interface UnreadMap {
  [agent: string]: number;
}

function AgentTile({
  agent,
  unread,
  index,
  onTap,
}: {
  agent: AgentName;
  unread: number;
  index: number;
  onTap: () => void;
}) {
  const config = AGENT_REGISTRY[agent];
  const [visible, setVisible] = useState(false);
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 40);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <button
      type="button"
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => { setPressing(false); onTap(); }}
      onPointerLeave={() => setPressing(false)}
      className="relative flex flex-col items-center gap-1.5 flex-shrink-0 transition-all duration-200"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? (pressing ? "scale(0.93)" : "scale(1)") : "scale(0.8)",
        transitionDelay: visible ? "0ms" : `${index * 40}ms`,
      }}
    >
      {/* Circle */}
      <div
        className="h-16 w-16 flex items-center justify-center rounded-full text-lg font-bold"
        style={{
          backgroundColor: `${config.color}22`,
          boxShadow: `0 0 0 2px ${config.color}`,
          color: config.color,
        }}
      >
        {config.name[0]}
      </div>

      {/* Unread badge */}
      {unread > 0 && (
        <div
          className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          style={{ animation: "badgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
        >
          {unread > 9 ? "9+" : unread}
        </div>
      )}

      {/* Name */}
      <span className="text-[10px] font-medium text-[var(--text-3)] truncate w-16 text-center">
        {config.name}
      </span>
    </button>
  );
}

export function CouncilDock() {
  const router = useRouter();
  const [unreads, setUnreads] = useState<UnreadMap>({});
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("agent_unread_counts")
        .select("agent_name, unread_count")
        .eq("user_id", user.id)
        .then(({ data }) => {
          const map: UnreadMap = {};
          (data ?? []).forEach((row) => { map[row.agent_name] = row.unread_count; });
          setUnreads(map);
        });
    });
  }, []);

  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-4">
        Council
      </p>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 px-4 pb-2">
          {AGENT_ORDER.map((agent, i) => (
            <AgentTile
              key={agent}
              agent={agent}
              unread={unreads[agent] ?? 0}
              index={i}
              onTap={() => router.push(`/pulse/${agent}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

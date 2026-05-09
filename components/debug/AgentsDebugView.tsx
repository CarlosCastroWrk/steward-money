"use client";

import { useState, useCallback } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

type AgentName = "luka" | "argus" | "solomon" | "silas" | "kairos" | "eden" | "nova" | "manna" | "iron" | "echo";

type Memory = {
  agent: string;
  summary: string;
  importance: number;
  created_at: string;
};

type AgentConfig = {
  name: AgentName;
  label: string;
  description: string;
  route: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
};

const AGENTS: AgentConfig[] = [
  { name: "luka",    label: "Luka",    description: "Personal finance co-pilot · chat agent",        route: "/api/luka",            method: "POST", body: { messages: [{ role: "user", content: "Quick health check — are you operational?" }] } },
  { name: "argus",   label: "Argus",   description: "Overdue bills · buffer breach · alerts engine", route: "/api/agents/argus",    method: "POST" },
  { name: "solomon", label: "Solomon", description: "Weekly stewardship report + score",              route: "/api/agents/solomon",  method: "POST" },
  { name: "silas",   label: "Silas",   description: "Spending pattern insights",                      route: "/api/agents/silas",    method: "POST" },
  { name: "kairos",  label: "Kairos",  description: "Life event detection + plan reviews",            route: "/api/agents/kairos",   method: "POST" },
  { name: "eden",    label: "Eden",    description: "Vision reflection + gratitude moments",          route: "/api/agents/eden",     method: "GET" },
  { name: "nova",    label: "Nova",    description: "Behavioral nudges + motivational messages",      route: "/api/agents/nova",     method: "GET" },
  { name: "manna",   label: "Manna",   description: "Daily allowance (daily bread) calculator",      route: "/api/agents/manna",    method: "GET" },
  { name: "iron",    label: "Iron",    description: "Commitments + accountability check-ins",         route: "/api/agents/iron",     method: "GET" },
  { name: "echo",    label: "Echo",    description: "Persistent memory store for user facts",         route: "/api/agents/echo",     method: "GET" },
];

type TriggerResult = { ok: boolean; output: string };

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AgentCard({
  config,
  lastMemory,
  allRunning,
}: {
  config: AgentConfig;
  lastMemory: Memory | null;
  allRunning: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TriggerResult | null>(null);

  const trigger = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const opts: RequestInit = { method: config.method };
      if (config.method === "POST") {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(config.body ?? {});
      }
      const res = await fetch(config.route, opts);
      const data = await res.json();
      const output = typeof data === "object"
        ? (data.reply ?? data.message ?? data.word ?? JSON.stringify(data, null, 2).slice(0, 400))
        : String(data);
      setResult({ ok: res.ok, output: String(output) });
    } catch (e) {
      setResult({ ok: false, output: String(e) });
    } finally {
      setRunning(false);
    }
  }, [config]);

  // Trigger when allRunning flips to true
  const wasAllRunning = useCallback(() => {
    if (allRunning && !running && !result) trigger();
  }, [allRunning, running, result, trigger]);
  if (allRunning && !running && !result) wasAllRunning();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AgentAvatar agent={config.name} size="md" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-1)]">{config.label}</p>
            <p className="text-[11px] text-[var(--text-3)]">{config.description}</p>
          </div>
        </div>
        <button
          onClick={trigger}
          disabled={running}
          className="flex-shrink-0 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-3)] transition hover:border-blue-700/40 hover:text-blue-400 disabled:opacity-40"
        >
          {running ? "Running…" : "Trigger"}
        </button>
      </div>

      {lastMemory && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Last activity</span>
            <span className="text-[10px] text-[var(--text-3)]">{timeSince(lastMemory.created_at)}</span>
          </div>
          <p className="text-xs text-[var(--text-2)] leading-relaxed">{lastMemory.summary}</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-3)]">importance</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-1 rounded-full ${i < lastMemory.importance ? "bg-blue-500" : "bg-[var(--border)]"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {!lastMemory && (
        <p className="text-xs text-[var(--text-3)] italic">No activity recorded yet</p>
      )}

      {result && (
        <div className={`rounded-xl border px-3 py-2 text-xs ${result.ok ? "border-green-700/30 bg-green-900/10 text-green-300" : "border-red-700/30 bg-red-900/10 text-red-300"}`}>
          <p className="font-medium mb-1">{result.ok ? "✓ Success" : "✕ Error"}</p>
          <p className="leading-relaxed opacity-80 whitespace-pre-wrap">{result.output.slice(0, 500)}</p>
        </div>
      )}
    </div>
  );
}

export function AgentsDebugView({
  memories,
}: {
  memories: Memory[];
}) {
  const [runAll, setRunAll] = useState(false);

  const memoryByAgent = Object.fromEntries(
    AGENTS.map((a) => [a.name, memories.find((m) => m.agent === a.name) ?? null])
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">Agent Control Room</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">Verify all agents are alive and trigger them on-demand.</p>
          </div>
          <button
            onClick={() => setRunAll(true)}
            className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Run All
          </button>
        </div>

        <div className="space-y-3">
          {AGENTS.map((agent) => (
            <AgentCard
              key={agent.name}
              config={agent}
              lastMemory={memoryByAgent[agent.name]}
              allRunning={runAll}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

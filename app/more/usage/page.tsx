import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "API Usage" };

interface UsageRow {
  agent_name: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  created_at: string;
}

const MODEL_DISPLAY: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet",
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-haiku-4-5": "Haiku",
};

const AGENT_COLORS: Record<string, string> = {
  luka:    "#7857ff",
  solomon: "#d4a857",
  kairos:  "#00d45a",
  argus:   "#4da6ff",
  iron:    "#ef4444",
  manna:   "#f0b800",
  eden:    "#ff6bda",
  nova:    "#b57fff",
  echo:    "#8899aa",
  silas:   "#00d4aa",
};

function fmt(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtMajor(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function UsagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: rows } = await supabase
    .from("agent_usage")
    .select("agent_name, model_used, input_tokens, output_tokens, estimated_cost, created_at")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: true });

  const usage: UsageRow[] = rows ?? [];

  // Totals
  const totalCost = usage.reduce((s, r) => s + Number(r.estimated_cost), 0);
  const totalInput = usage.reduce((s, r) => s + r.input_tokens, 0);
  const totalOutput = usage.reduce((s, r) => s + r.output_tokens, 0);
  const totalRequests = usage.length;

  // By model
  const byModel: Record<string, { cost: number; requests: number }> = {};
  for (const r of usage) {
    const key = MODEL_DISPLAY[r.model_used] ?? r.model_used;
    if (!byModel[key]) byModel[key] = { cost: 0, requests: 0 };
    byModel[key].cost += Number(r.estimated_cost);
    byModel[key].requests++;
  }

  // By agent
  const byAgent: Record<string, { cost: number; requests: number }> = {};
  for (const r of usage) {
    if (!byAgent[r.agent_name]) byAgent[r.agent_name] = { cost: 0, requests: 0 };
    byAgent[r.agent_name].cost += Number(r.estimated_cost);
    byAgent[r.agent_name].requests++;
  }
  const agentsSorted = Object.entries(byAgent).sort((a, b) => b[1].cost - a[1].cost);

  // Daily sparkline (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const { data: allRows } = await supabase
    .from("agent_usage")
    .select("estimated_cost, created_at")
    .eq("user_id", user.id)
    .gte("created_at", thirtyDaysAgo.toISOString());

  const dailyMap: Record<string, number> = {};
  for (const r of allRows ?? []) {
    const day = r.created_at.split("T")[0];
    dailyMap[day] = (dailyMap[day] ?? 0) + Number(r.estimated_cost);
  }
  const days30: { date: string; cost: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().split("T")[0];
    days30.push({ date: d, cost: dailyMap[d] ?? 0 });
  }
  const maxDaily = Math.max(...days30.map((d) => d.cost), 0.0001);

  const monthName = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="px-4 pb-10 pt-5 md:px-8 md:pt-8 max-w-lg">
      {/* Back */}
      <Link href="/more" className="flex items-center gap-1 text-sm text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors mb-5">
        <ChevronLeft size={16} strokeWidth={2} />
        More
      </Link>

      <h1 className="text-2xl font-semibold text-[var(--text-1)] mb-1">API Usage</h1>
      <p className="text-sm text-[var(--text-2)] mb-6">{monthName}</p>

      {usage.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm font-medium text-[var(--text-2)]">No usage yet.</p>
          <p className="mt-1 text-xs text-[var(--text-3)]">Talk to Luka to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* This month summary */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)] mb-3">This month</p>
            <p className="text-3xl font-bold text-[var(--text-1)]">{fmtMajor(totalCost)}</p>
            <p className="mt-1 text-xs text-[var(--text-3)]">{totalRequests} requests · {(totalInput + totalOutput).toLocaleString()} tokens</p>

            <div className="mt-4 space-y-2">
              {Object.entries(byModel).map(([model, { cost, requests }]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-2)]">{model}</span>
                  <span className="text-[var(--text-1)] font-medium">
                    {fmtMajor(cost)} <span className="text-[var(--text-3)] font-normal text-xs">({requests})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Per agent */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-1">By agent</p>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              {agentsSorted.map(([agent, { cost, requests }], i) => (
                <div
                  key={agent}
                  className={`flex items-center gap-3 px-4 py-3 ${i < agentsSorted.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                >
                  <div
                    className="h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: AGENT_COLORS[agent] ?? "#7857ff" }}
                  >
                    {agent[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-[var(--text-1)] capitalize">{agent}</span>
                  <span className="text-xs text-[var(--text-3)]">{requests}×</span>
                  <span className="text-sm font-medium text-[var(--text-1)] tabular-nums">{fmt(cost)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sparkline */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] px-1">Last 30 days</p>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-end gap-0.5 h-16">
                {days30.map(({ date, cost }) => (
                  <div
                    key={date}
                    className="flex-1 rounded-t-sm min-h-[2px] transition-all"
                    style={{
                      height: `${Math.max((cost / maxDaily) * 100, cost > 0 ? 4 : 0)}%`,
                      backgroundColor: cost > 0 ? "var(--accent)" : "var(--bg-elevated)",
                      opacity: cost > 0 ? 0.8 : 1,
                    }}
                    title={`${date}: ${fmt(cost)}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-[var(--text-3)]">
                <span>30d ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

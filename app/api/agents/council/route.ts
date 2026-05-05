import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { summarizeAgentMemoriesForLuka } from "@/lib/agent-memory";
import { checkRateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic();

interface AgentVoice {
  agent: string;
  role: string;
  color: string;
  persona: string;
}

const COUNCIL_AGENTS: AgentVoice[] = [
  { agent: "luka", color: "#7c5cff", role: "Financial Advisor", persona: "Practical, data-driven, warm. Focuses on the numbers and immediate actions." },
  { agent: "solomon", color: "#d4a857", role: "Wisdom Keeper", persona: "Weighs long-term stewardship, life patterns, and weekly rhythms. Speaks with gravitas." },
  { agent: "silas", color: "#2dd4bf", role: "Pattern Analyst", persona: "Notices behavioral trends, spending patterns, and subtle shifts. Sharp and specific." },
  { agent: "argus", color: "#60a5fa", role: "Risk Watchdog", persona: "Identifies risks, flags danger zones, watches the perimeter. Concise and urgent." },
  { agent: "eden", color: "#ec4899", role: "Vision Keeper", persona: "Connects finances to purpose, soul, and the deeper why. Warm and heart-centered." },
  { agent: "nova", color: "#a78bfa", role: "Foresight Agent", persona: "Looks ahead 30-90 days, anticipates inflection points. Forward-focused and specific." },
];

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(user.id, "/api/agents/council");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Council is resting. Try again soon." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60000) / 1000)) } }
    );
  }

  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [safeResult, settingsRes, goalsRes, billsRes, spendingRes, alertsRes, memoryContext] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("user_settings").select("display_name, life_stage, main_goal, personal_vision").eq("user_id", user.id).maybeSingle(),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", user.id).order("priority", { ascending: true }).limit(5),
    supabase.from("bills").select("name, amount, next_due_date").eq("user_id", user.id).not("next_due_date", "is", null).gte("next_due_date", today).order("next_due_date", { ascending: true }).limit(5),
    supabase.from("transactions").select("category, amount").eq("user_id", user.id).lt("amount", 0).gte("date", monthStart),
    supabase.from("alerts").select("message, severity").eq("user_id", user.id).eq("is_read", false).limit(3),
    summarizeAgentMemoriesForLuka(supabase, user.id),
  ]);

  const settings = settingsRes.data;
  const goals = goalsRes.data ?? [];
  const bills = billsRes.data ?? [];
  const spending = spendingRes.data ?? [];
  const alerts = alertsRes.data ?? [];
  const totalSpent = spending.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const context = `
User: ${settings?.display_name ?? "Unknown"} | Life stage: ${settings?.life_stage ?? "unknown"} | Main goal: ${settings?.main_goal ?? "unknown"}
Personal vision: ${settings?.personal_vision ?? "not set"}
Safe-to-spend: $${safeResult.safeToSpend.toFixed(0)} | Liquid: $${safeResult.liquidTotal.toFixed(0)}
Next income: ${safeResult.nextIncomeDate ?? "unknown"} ($${safeResult.nextIncomeAmount.toFixed(0)})
Bills due soon: $${safeResult.billsDueSoon.toFixed(0)}
Spent this month: $${totalSpent.toFixed(0)}
Goals: ${goals.map((g) => `${g.name} ${Math.round((g.current_amount / g.target_amount) * 100)}%`).join(", ") || "none"}
Active alerts: ${alerts.map((a) => a.message).join("; ") || "none"}
${memoryContext}
`.trim();

  // Fan out to all 6 agents in parallel
  const responses = await Promise.all(
    COUNCIL_AGENTS.map(async (agent) => {
      const prompt = `You are ${agent.agent.charAt(0).toUpperCase() + agent.agent.slice(1)}, the ${agent.role} on the Steward Financial Council.

Your persona: ${agent.persona}

Financial context:
${context}

The question before the council: "${question}"

Respond in 2-4 sentences from your unique perspective. Stay in character. Be specific — reference their actual numbers when relevant. No preamble.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      return {
        agent: agent.agent,
        color: agent.color,
        role: agent.role,
        response: (message.content[0] as { type: string; text: string }).text,
      };
    })
  );

  // Synthesize
  const synthesisPrompt = `You are a neutral synthesizer of a financial council session.

Question: "${question}"

Council responses:
${responses.map((r) => `${r.agent.toUpperCase()} (${r.role}): ${r.response}`).join("\n\n")}

Write a 2-3 sentence synthesis that:
- Distills the key consensus and most important divergence
- Ends with one clear recommended next action
- Is written directly to the user (use "you")

Be concise and actionable.`;

  const synthesisMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: synthesisPrompt }],
  });

  const synthesis = (synthesisMsg.content[0] as { type: string; text: string }).text;

  // Save session
  await supabase.from("council_sessions").insert({
    user_id: user.id,
    question,
    responses: Object.fromEntries(responses.map((r) => [r.agent, r.response])),
    synthesis,
  });

  return NextResponse.json({ question, responses, synthesis });
}

// GET — recent council sessions
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("council_sessions")
    .select("id, question, responses, synthesis, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ sessions: data ?? [] });
}

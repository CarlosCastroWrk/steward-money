import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingEvents, formatCalendarContextForAgent } from "@/lib/calendar-context";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";
import { logAgentUsage } from "@/lib/agents/log-usage";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agent, messages, context } = await req.json() as {
    agent: AgentName;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context?: string;
  };

  const config = AGENT_REGISTRY[agent];
  if (!config) return NextResponse.json({ error: "Unknown agent" }, { status: 400 });

  // Kairos gets enriched context: calendar events + financial summary
  let enrichedContext = context ?? "";
  if (agent === "kairos") {
    const [calendarEvents, safeResult] = await Promise.all([
      getUpcomingEvents(supabase, user.id, 30),
      calculateSafeToSpend(supabase, user.id),
    ]);
    const calCtx = formatCalendarContextForAgent(calendarEvents);
    const finCtx = `Current financial position: Safe-to-spend $${safeResult.safeToSpend.toFixed(0)}, liquid cash $${safeResult.liquidTotal.toFixed(0)}.`;
    enrichedContext = [enrichedContext, calCtx, finCtx].filter(Boolean).join("\n\n");
  }

  const systemPrompt = enrichedContext
    ? `${config.systemPrompt}\n\nContext for this conversation: ${enrichedContext}`
    : config.systemPrompt;

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0]?.type === "text" ? response.content[0].text : "";

    // Persist conversation turn
    await supabase.from("agent_conversations").insert([
      { user_id: user.id, agent_name: agent, role: "user", content: messages[messages.length - 1]?.content ?? "" },
      { user_id: user.id, agent_name: agent, role: "assistant", content: reply },
    ]);

    // Log usage
    await logAgentUsage(
      supabase,
      user.id,
      agent,
      config.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
    );

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[agents/chat] error:", err);
    return NextResponse.json({ error: "Agent unavailable" }, { status: 500 });
  }
}

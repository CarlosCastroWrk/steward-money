import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [safeRes, goalsRes, settingsRes, weeklyRes] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", user.id).order("priority", { ascending: true }).limit(3),
    supabase.from("user_settings").select("giving_value, savings_value, trading_value, emergency_buffer, display_name, life_stage, main_goal").eq("user_id", user.id).maybeSingle(),
    supabase.from("weekly_reports").select("stewardship_score, solomon_word").eq("user_id", user.id).order("week_start", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const goals = goalsRes.data ?? [];
  const settings = settingsRes.data;
  const weeklyReport = weeklyRes.data;

  const systemPrompt = `You are Solomon, the financial wisdom agent for Steward Money. You give concise, biblical-principles-grounded strategic financial recommendations. Be specific and actionable. 2-3 sentences max. No generic advice.`;

  const userPrompt = `Generate a strategic recommendation for this week based on:
- Safe to spend: $${safeRes.safeToSpend.toFixed(0)}
- Liquid total: $${safeRes.liquidTotal.toFixed(0)}
- Life stage: ${settings?.life_stage ?? "not set"}
- Main goal: ${settings?.main_goal ?? "not set"}
- Top goals: ${goals.map((g) => `${g.name} (${Math.round((g.current_amount / g.target_amount) * 100)}%)`).join(", ") || "none"}
- Stewardship score last week: ${weeklyReport?.stewardship_score ?? "none"}
- Allocations: giving ${settings?.giving_value ?? 0}, savings ${settings?.savings_value ?? 0}

Focus on one key move this week. Be direct.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const strategy = response.content[0].type === "text" ? response.content[0].text : null;
    return NextResponse.json({ strategy });
  } catch {
    return NextResponse.json({ strategy: null });
  }
}

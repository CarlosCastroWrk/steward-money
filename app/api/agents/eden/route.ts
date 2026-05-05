import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { saveAgentMemory } from "@/lib/agent-memory";

const anthropic = new Anthropic();

// GET — fetch vision + recent moments
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settingsRes, momentsRes] = await Promise.all([
    supabase.from("user_settings").select("personal_vision, display_name, life_stage, main_goal").eq("user_id", user.id).maybeSingle(),
    supabase.from("vision_moments").select("id, content, moment_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    vision: settingsRes.data?.personal_vision ?? null,
    displayName: settingsRes.data?.display_name ?? "Friend",
    lifeStage: settingsRes.data?.life_stage ?? null,
    mainGoal: settingsRes.data?.main_goal ?? null,
    moments: momentsRes.data ?? [],
  });
}

// POST — generate Eden's reflection + optionally save moment
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { momentContent, momentType = "gratitude" } = body as { momentContent?: string; momentType?: string };

  const [settingsRes, goalsRes, recentMomentsRes] = await Promise.all([
    supabase.from("user_settings").select("personal_vision, display_name, life_stage, main_goal").eq("user_id", user.id).maybeSingle(),
    supabase.from("goals").select("name, target_amount, current_amount").eq("user_id", user.id).order("priority", { ascending: true }).limit(3),
    supabase.from("vision_moments").select("content, moment_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const settings = settingsRes.data;
  const goals = goalsRes.data ?? [];
  const recentMoments = recentMomentsRes.data ?? [];

  if (momentContent) {
    await supabase.from("vision_moments").insert({
      user_id: user.id,
      content: momentContent,
      moment_type: momentType,
    });
  }

  const prompt = `You are Eden, the vision and soul agent for ${settings?.display_name ?? "this person"}. You see the deeper why behind their financial journey — connecting their daily choices to their larger purpose and calling.

Their personal vision: ${settings?.personal_vision ?? "not yet written"}
Life stage: ${settings?.life_stage ?? "unknown"}
Main goal: ${settings?.main_goal ?? "unknown"}

Active goals: ${goals.map((g) => `${g.name} (${Math.round((g.current_amount / g.target_amount) * 100)}% funded)`).join(", ") || "none"}

Recent moments they've recorded: ${recentMoments.map((m) => `"${m.content}" (${m.moment_type})`).join("; ") || "none yet"}

${momentContent ? `They just recorded this moment: "${momentContent}" (${momentType})` : "Generate a daily vision reflection."}

Write a 2-3 sentence reflection that:
- Connects their financial faithfulness to deeper purpose
- Is warm, personal, and spiritually grounded
- Doesn't use financial jargon — speak to their heart
- Ends with one gentle question or invitation

Be Eden: poetic, purposeful, soul-aware.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const reflection = (message.content[0] as { type: string; text: string }).text;

  await saveAgentMemory(supabase, user.id, "eden",
    `Reflected on vision: ${settings?.personal_vision?.slice(0, 60) ?? "not set"}. ${momentContent ? `New moment: ${momentContent.slice(0, 60)}` : "Daily reflection generated."}`,
    4
  );

  return NextResponse.json({ reflection, momentSaved: !!momentContent });
}

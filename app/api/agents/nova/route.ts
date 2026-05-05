import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { saveAgentMemory } from "@/lib/agent-memory";

const anthropic = new Anthropic();

// GET — fetch unread Nova messages
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("nova_messages")
    .select("id, message, trigger_type, created_at")
    .eq("user_id", user.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(3);

  return NextResponse.json({ messages: data ?? [] });
}

async function generateNovaMessage(supabase: ReturnType<typeof createClient>, userId: string, triggerType: string) {
  const today = new Date().toISOString().split("T")[0];

  const [safeResult, settingsRes, goalsRes, billsRes] = await Promise.all([
    calculateSafeToSpend(supabase, userId),
    supabase.from("user_settings").select("display_name, life_stage, main_goal").eq("user_id", userId).maybeSingle(),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId).order("priority", { ascending: true }).limit(3),
    supabase.from("bills").select("name, amount, next_due_date").eq("user_id", userId).not("next_due_date", "is", null).gte("next_due_date", today).order("next_due_date", { ascending: true }).limit(5),
  ]);

  const settings = settingsRes.data;
  const goals = goalsRes.data ?? [];
  const bills = billsRes.data ?? [];
  const safeToSpend = safeResult.safeToSpend;
  const nextIncome = safeResult.nextIncomeDate;

  const prompt = `You are Nova, the forward-looking financial foresight agent for ${settings?.display_name ?? "this person"}.

Current safe-to-spend: $${safeToSpend.toFixed(0)}
Next income: ${nextIncome ?? "unknown"}
Upcoming bills: ${bills.map((b) => `${b.name} $${Number(b.amount).toFixed(0)} due ${b.next_due_date}`).join(", ") || "none"}
Goals: ${goals.map((g) => `${g.name} at ${Math.round((g.current_amount / g.target_amount) * 100)}%`).join(", ") || "none"}

Write ONE forward-looking observation (1-2 sentences max) about what's coming in their financial week. Focus on:
- An upcoming opportunity or risk
- A specific action they could take proactively
- NOT generic advice — be specific to their numbers

Be Nova: brief, sharp, forward-focused. No fluff.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const nova = (message.content[0] as { type: string; text: string }).text;

  await supabase.from("nova_messages").insert({
    user_id: userId,
    message: nova,
    trigger_type: triggerType,
  });

  await saveAgentMemory(supabase, userId, "nova",
    `Forward observation generated. Safe-to-spend: $${safeToSpend.toFixed(0)}. Next income: ${nextIncome ?? "unknown"}.`,
    5
  );

  return nova;
}

// POST — generate a Nova message (cron or on-demand)
export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    const admin = createAdminClient();
    const { data: users } = await admin.from("user_settings").select("user_id");
    const userIds = (users ?? []).map((u) => u.user_id);

    for (const userId of userIds) {
      try {
        const supabase = createClient();
        await generateNovaMessage(supabase, userId, "scheduled");
      } catch { /* continue */ }
    }
    return NextResponse.json({ ok: true, count: userIds.length });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nova = await generateNovaMessage(supabase, user.id, "on_demand");
  return NextResponse.json({ ok: true, message: nova });
}

// PATCH — mark message as read
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("nova_messages").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

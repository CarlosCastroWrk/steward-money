import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { saveAgentMemory } from "@/lib/agent-memory";

const anthropic = new Anthropic();

// GET — fetch commitments + recent checkins
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [commitmentsRes, checkinsRes] = await Promise.all([
    supabase.from("commitments").select("id, title, description, commitment_type, target_amount, frequency, is_active, created_at").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("commitment_checkins").select("commitment_id, kept, note, checked_in_at").eq("user_id", user.id).order("checked_in_at", { ascending: false }).limit(20),
  ]);

  const commitments = commitmentsRes.data ?? [];
  const checkins = checkinsRes.data ?? [];

  const enriched = commitments.map((c) => {
    const cCheckins = checkins.filter((ci) => ci.commitment_id === c.id);
    const streak = cCheckins.reduce((acc, ci) => ci.kept ? acc + 1 : 0, 0);
    const rate = cCheckins.length > 0 ? Math.round((cCheckins.filter((ci) => ci.kept).length / cCheckins.length) * 100) : null;
    return { ...c, streak, adherenceRate: rate, recentCheckins: cCheckins.slice(0, 3) };
  });

  return NextResponse.json({ commitments: enriched });
}

// POST — check in on a commitment or create one
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body as { action: string };

  if (action === "create") {
    const { title, description, commitment_type, target_amount, frequency } = body;
    const { data, error } = await supabase.from("commitments").insert({
      user_id: user.id, title, description, commitment_type, target_amount, frequency,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ commitment: data });
  }

  if (action === "checkin") {
    const { commitment_id, kept, note } = body;
    await supabase.from("commitment_checkins").insert({
      user_id: user.id, commitment_id, kept, note,
    });

    const { data: commitment } = await supabase.from("commitments").select("title").eq("id", commitment_id).single();

    const settingsRes = await supabase.from("user_settings").select("display_name").eq("user_id", user.id).maybeSingle();
    const displayName = settingsRes.data?.display_name ?? "Friend";

    const prompt = `You are Iron, the accountability agent. ${displayName} just checked in on their commitment: "${commitment?.title}".
They ${kept ? "kept" : "did not keep"} their commitment today. ${note ? `Their note: "${note}"` : ""}

Write a 1-2 sentence response:
- If kept: affirm with brief, genuine encouragement (not generic). Reference the commitment.
- If not kept: be gracious and forward-looking, not harsh. Challenge them gently for tomorrow.

Be Iron: honest, brief, accountable, kind.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const feedback = (message.content[0] as { type: string; text: string }).text;

    await saveAgentMemory(supabase, user.id, "iron",
      `${displayName} checked in on "${commitment?.title}": ${kept ? "KEPT" : "MISSED"}. ${note ? `Note: ${note.slice(0, 50)}` : ""}`,
      kept ? 4 : 6
    );

    return NextResponse.json({ feedback, kept });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

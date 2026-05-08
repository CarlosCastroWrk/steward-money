import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversation_id } = await req.json();
  if (!conversation_id) return NextResponse.json({ error: "conversation_id required" }, { status: 400 });

  const { data: messages } = await supabase
    .from("luka_conversations")
    .select("role, content")
    .eq("user_id", user.id)
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true })
    .limit(6);

  if (!messages?.length) return NextResponse.json({ title: "New conversation" });

  const excerpt = messages
    .map((m) => `${m.role === "user" ? "User" : "Luka"}: ${String(m.content).slice(0, 120)}`)
    .join("\n");

  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [
      {
        role: "user",
        content: `Generate a 4-6 word conversation title (no quotes, no punctuation) for this chat:\n\n${excerpt}`,
      },
    ],
  });

  const title = resp.content[0].type === "text"
    ? resp.content[0].text.trim().replace(/[".]/g, "")
    : "New conversation";

  await supabase
    .from("luka_conversations")
    .update({ title })
    .eq("user_id", user.id)
    .eq("conversation_id", conversation_id);

  return NextResponse.json({ title });
}

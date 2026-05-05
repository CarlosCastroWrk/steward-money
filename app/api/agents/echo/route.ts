import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — fetch all memories for the user
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("echo_memories")
    .select("id, memory_key, memory_value, memory_type, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json({ memories: data ?? [] });
}

// POST — save or update a memory (upsert by key)
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memory_key, memory_value, memory_type = "fact" } = await req.json();
  if (!memory_key || !memory_value) {
    return NextResponse.json({ error: "memory_key and memory_value required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("echo_memories").upsert({
    user_id: user.id,
    memory_key,
    memory_value,
    memory_type,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,memory_key" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memory: data });
}

// DELETE — remove a memory by id
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("echo_memories").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

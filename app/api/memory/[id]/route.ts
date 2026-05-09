import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMemory, deleteMemory } from "@/lib/memory";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json() as { content: string };
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const ok = await updateMemory(supabase, user.id, params.id, content.trim());
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Failed to update" }, { status: 500 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ok = await deleteMemory(supabase, user.id, params.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Failed to delete" }, { status: 500 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { event_id?: string; notes?: string };
  const { event_id, notes } = body;

  if (!event_id) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const { error } = await supabase
    .from("calendar_events_cache")
    .update({ user_notes: notes ?? null })
    .eq("id", event_id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

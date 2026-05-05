import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit";

// POST — store Google OAuth tokens after client-side OAuth completes
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { access_token, refresh_token, expires_in } = await req.json();
  if (!access_token) return NextResponse.json({ error: "access_token required" }, { status: 400 });

  const expiresAt = expires_in
    ? new Date(Date.now() + Number(expires_in) * 1000).toISOString()
    : null;

  const { error } = await supabase.from("calendar_connections").upsert({
    user_id: user.id,
    access_token,
    refresh_token: refresh_token ?? null,
    expires_at: expiresAt,
    connected_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditEvent(supabase, user.id, "calendar_connected");

  return NextResponse.json({ ok: true });
}

// DELETE — disconnect calendar
export async function DELETE() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("calendar_connections").delete().eq("user_id", user.id);
  await supabase.from("calendar_events_cache").delete().eq("user_id", user.id);
  await logAuditEvent(supabase, user.id, "calendar_disconnected");

  return NextResponse.json({ ok: true });
}

// GET — check connection status
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("calendar_connections")
    .select("connected_at, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ connected: !!data, connectedAt: data?.connected_at ?? null });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [connResult, eventsResult] = await Promise.all([
    supabase
      .from("calendar_connections")
      .select("connected_at, expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("calendar_events_cache")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString()),
  ]);

  return NextResponse.json({
    connected: !!connResult.data,
    connectedAt: connResult.data?.connected_at ?? null,
    expiresAt: connResult.data?.expires_at ?? null,
    eventsCount: eventsResult.count ?? 0,
  });
}

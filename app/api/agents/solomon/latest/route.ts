import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const { data } = await supabase
    .from("weekly_reports")
    .select("solomon_word, stewardship_score, week_start, lived_within_provision, giving_honored")
    .eq("user_id", user.id)
    .eq("week_start", weekStartStr)
    .maybeSingle();

  return NextResponse.json({ report: data ?? null });
}

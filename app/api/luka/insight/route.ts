import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveInsight, generateInsightIfNeeded } from "@/lib/daily-insight";

// GET — return the active insight (read-only, used by client-side refreshes)
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insight = await getActiveInsight(supabase, user.id);
  return NextResponse.json({ insight });
}

// POST — trigger regeneration if needed, or force if debug
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force === true;

  if (force && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Force regeneration is only available in development" }, { status: 403 });
  }

  const insight = await generateInsightIfNeeded(supabase, user.id, force);
  return NextResponse.json({ insight, generated: !!insight });
}

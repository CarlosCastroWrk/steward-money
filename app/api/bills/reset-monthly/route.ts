import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";

// Called by Vercel cron on the 1st of every month at midnight
// Clears paid_at for all monthly bills so the new month starts fresh
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { error, count } = await admin
    .from("bills")
    .update({ paid_at: null, auto_detected_paid: false })
    .in("frequency", ["monthly", "biweekly", "weekly"])
    .not("paid_at", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reset: count ?? 0 });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by Vercel cron on the 1st of every month at midnight
// Clears paid_at for all monthly bills so the new month starts fresh
export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";
  if (!isCron) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { error, count } = await admin
    .from("bills")
    .update({ paid_at: null, auto_detected_paid: false })
    .in("frequency", ["monthly", "biweekly", "weekly"])
    .not("paid_at", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reset: count ?? 0 });
}

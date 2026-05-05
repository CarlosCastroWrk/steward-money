import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { saveAgentMemory } from "@/lib/agent-memory";

// GET — compute today's daily allowance ("daily bread")
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  // Check if we already have today's record
  const { data: existing } = await supabase
    .from("manna_daily")
    .select("daily_allowance, spent_today, date")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      date: existing.date,
      dailyAllowance: existing.daily_allowance,
      spentToday: existing.spent_today,
      remaining: existing.daily_allowance - existing.spent_today,
    });
  }

  // Compute from safe-to-spend
  const result = await calculateSafeToSpend(supabase, user.id);
  const safeToSpend = Math.max(0, result.safeToSpendRaw);

  const nextIncomeDate = result.nextIncomeDate;
  let daysUntilPaycheck = 14;
  if (nextIncomeDate) {
    const diff = Math.ceil((new Date(nextIncomeDate).getTime() - Date.now()) / 86_400_000);
    daysUntilPaycheck = Math.max(1, diff);
  }

  const dailyAllowance = daysUntilPaycheck > 0 ? safeToSpend / daysUntilPaycheck : 0;

  // Get today's spending
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const { data: txToday } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .gte("date", today);

  const spentToday = (txToday ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // Upsert today's record
  await supabase.from("manna_daily").upsert({
    user_id: user.id,
    date: today,
    daily_allowance: dailyAllowance,
    spent_today: spentToday,
  }, { onConflict: "user_id,date" });

  await saveAgentMemory(supabase, user.id, "manna",
    `Daily bread: $${dailyAllowance.toFixed(0)}/day. Safe-to-spend: $${safeToSpend.toFixed(0)}. Days to paycheck: ${daysUntilPaycheck}.`,
    3
  );

  return NextResponse.json({
    date: today,
    dailyAllowance,
    spentToday,
    remaining: dailyAllowance - spentToday,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { saveAgentMemory } from "@/lib/agent-memory";
import { getUpcomingEvents } from "@/lib/calendar-context";

// GET — compute today's daily allowance ("daily bread")
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  // Always compute fresh math (safeToSpend, daysUntilPaycheck) for display
  const result = await calculateSafeToSpend(supabase, user.id);
  const safeToSpendRaw = result.safeToSpendRaw;
  const safeToSpend = Math.max(0, safeToSpendRaw);
  const isNegative = safeToSpendRaw < 0;

  const nextIncomeDate = result.nextIncomeDate;
  const hasPaycheckDate = !!nextIncomeDate;
  let daysUntilPaycheck = 14;
  if (nextIncomeDate) {
    const diff = Math.ceil((new Date(nextIncomeDate).getTime() - Date.now()) / 86_400_000);
    daysUntilPaycheck = Math.max(1, diff);
  }

  const dailyAllowance = (!isNegative && daysUntilPaycheck > 0) ? safeToSpend / daysUntilPaycheck : 0;

  // Get today's spending
  const { data: txToday } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .gte("date", today);

  const spentToday = (txToday ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // Pull upcoming calendar events to surface as context (no changes to core calculation)
  const upcomingEvents = await getUpcomingEvents(supabase, user.id, 14);
  const upcomingEventCost = upcomingEvents
    .filter((e) => !e.is_income_event && e.spending_estimate > 0)
    .reduce((s, e) => s + e.spending_estimate, 0);
  const nextBigEvent = upcomingEvents
    .filter((e) => !e.is_income_event && e.spending_estimate >= 50)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0] ?? null;

  // Suggested adjusted allowance: set aside upcoming event costs spread across days
  const adjustedDailyAllowance = upcomingEventCost > 0 && daysUntilPaycheck > 0
    ? Math.max(0, (safeToSpend - upcomingEventCost) / daysUntilPaycheck)
    : dailyAllowance;

  // Check if we already cached today
  const { data: existing } = await supabase
    .from("manna_daily")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (!existing) {
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
  }

  return NextResponse.json({
    date: today,
    dailyAllowance,
    adjustedDailyAllowance,
    spentToday,
    remaining: dailyAllowance - spentToday,
    safeToSpend,
    daysUntilPaycheck,
    hasPaycheckDate,
    isNegative,
    upcomingEventCost,
    nextBigEvent: nextBigEvent ? {
      title: nextBigEvent.title,
      date: nextBigEvent.start_time,
      estimate: nextBigEvent.spending_estimate,
    } : null,
  });
}

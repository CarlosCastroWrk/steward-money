import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { saveAgentMemory } from "@/lib/agent-memory";

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
    spentToday,
    remaining: dailyAllowance - spentToday,
    safeToSpend,
    daysUntilPaycheck,
    hasPaycheckDate,
    isNegative,
  });
}

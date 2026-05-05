import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";

export type AllocationLine = {
  label: string;
  amount: number;
  color: string;
  emoji: string;
};

export type AllocationResult = {
  income: number;
  lines: AllocationLine[];
  flex: number;
};

async function buildAllocation(userId: string, supabase: ReturnType<typeof createClient>, incomeOverride?: number): Promise<AllocationResult> {
  const [safeResult, settingsResult, billsResult, goalsResult] = await Promise.all([
    calculateSafeToSpend(supabase, userId),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("bills").select("name, amount, next_due_date, is_autopay").eq("user_id", userId),
    supabase.from("goals").select("id, name, target_amount, current_amount, priority, deadline").eq("user_id", userId).order("priority", { ascending: true }),
  ]);

  const settings = settingsResult.data;
  const income = incomeOverride ?? safeResult.nextIncomeAmount;
  const lines: AllocationLine[] = [];
  let remaining = income;

  // Step 1 — Giving
  if (settings?.giving_enabled) {
    const pct = Number(settings.giving_value ?? 10) / 100;
    const amount = settings.giving_type === "percentage"
      ? income * pct
      : Number(settings.giving_value ?? 0);
    lines.push({ label: "Giving / Tithe", amount, color: "bg-green-500", emoji: "🙏" });
    remaining -= amount;
  }

  // Step 2 — Bills due before next income
  const today = new Date().toISOString().split("T")[0];
  const nextIncome = safeResult.nextIncomeDate ?? new Date(Date.now() + 14 * 86_400_000).toISOString().split("T")[0];
  const dueBills = (billsResult.data ?? []).filter((b) => b.next_due_date && b.next_due_date >= today && b.next_due_date <= nextIncome);
  const billsTotal = dueBills.reduce((s, b) => s + Number(b.amount), 0);
  if (billsTotal > 0) {
    lines.push({ label: "Bills covered", amount: Math.min(billsTotal, remaining), color: "bg-red-500", emoji: "📄" });
    remaining -= Math.min(billsTotal, remaining);
  }

  // Step 3 — Savings
  let savingsAmount = 0;
  if (settings?.savings_rule === "percentage") {
    savingsAmount = income * (Number(settings.savings_value ?? 0) / 100);
  } else if (["fixed_paycheck", "fixed_per_paycheck"].includes(settings?.savings_rule)) {
    savingsAmount = Number(settings.savings_value ?? 0);
  }
  if (savingsAmount > 0 && remaining > 0) {
    const amt = Math.min(savingsAmount, remaining);
    lines.push({ label: "Savings", amount: amt, color: "bg-blue-500", emoji: "💰" });
    remaining -= amt;
  }

  // Step 4 — Emergency buffer top-up
  const bufferTarget = Number(settings?.emergency_buffer ?? 500);
  if (safeResult.liquidTotal < bufferTarget && remaining > 0) {
    const topUp = Math.min(bufferTarget - safeResult.liquidTotal, remaining * 0.1, remaining);
    if (topUp > 10) {
      lines.push({ label: "Emergency buffer top-up", amount: topUp, color: "bg-amber-500", emoji: "🛡️" });
      remaining -= topUp;
    }
  }

  // Step 5 — Goal contributions
  for (const goal of (goalsResult.data ?? []).slice(0, 3)) {
    if (remaining <= 0) break;
    const needed = Number(goal.target_amount) - Number(goal.current_amount);
    if (needed <= 0) continue;
    const weekly = goal.deadline
      ? Math.max(0, needed / Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (7 * 86_400_000))))
      : needed * 0.05;
    const contrib = Math.min(weekly, remaining * 0.15, remaining);
    if (contrib > 5) {
      lines.push({ label: goal.name, amount: contrib, color: "bg-purple-500", emoji: "🎯" });
      remaining -= contrib;
    }
  }

  // Step 6 — Trading
  let tradingAmount = 0;
  if (settings?.trading_rule === "percentage") {
    tradingAmount = income * (Number(settings.trading_value ?? 0) / 100);
  } else if (["fixed_paycheck", "fixed_per_paycheck"].includes(settings?.trading_rule)) {
    tradingAmount = Number(settings.trading_value ?? 0);
  }
  if (tradingAmount > 0 && remaining > 0) {
    const amt = Math.min(tradingAmount, remaining);
    lines.push({ label: "Trading / Investing", amount: amt, color: "bg-cyan-500", emoji: "📈" });
    remaining -= amt;
  }

  const flex = Math.max(0, remaining);

  return { income, lines, flex };
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const incomeParam = req.nextUrl.searchParams.get("income");
  const incomeOverride = incomeParam ? Number(incomeParam) : undefined;

  const result = await buildAllocation(user.id, supabase, incomeOverride);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const result = await buildAllocation(user.id, supabase, body.income);
  return NextResponse.json(result);
}

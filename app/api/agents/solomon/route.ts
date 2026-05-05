import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreStewardship } from "@/lib/stewardship";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function runSolomon(supabase: ReturnType<typeof createClient>, userId: string) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Sunday
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

  const [txRes, goalsRes, settingsRes, incomeRes] = await Promise.all([
    supabase.from("transactions").select("date, merchant, amount, category").eq("user_id", userId).gte("date", sevenDaysAgo),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("income_sources").select("amount, frequency").eq("user_id", userId).eq("is_active", true),
  ]);

  const transactions = txRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const settings = settingsRes.data;
  const displayName = settings?.display_name ?? "there";

  const incomeTotal = transactions.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const spendingTotal = transactions.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const givingTotal = transactions
    .filter((t) => ["giving", "tithe", "donation"].some((k) => (t.category ?? "").toLowerCase().includes(k)))
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const categoryMap = new Map<string, number>();
  for (const tx of transactions.filter((t) => Number(t.amount) < 0)) {
    const k = tx.category ?? "Other";
    categoryMap.set(k, (categoryMap.get(k) ?? 0) + Math.abs(Number(tx.amount)));
  }
  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount, pct: spendingTotal > 0 ? Math.round((amount / spendingTotal) * 100) : 0 }));

  const biggestTx = [...transactions]
    .filter((t) => Number(t.amount) < 0)
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))[0];

  const givingHonored = settings?.giving_enabled ? givingTotal > 0 : true;
  const livedWithinProvision = spendingTotal <= incomeTotal || incomeTotal === 0;
  const savingsHonored = spendingTotal < incomeTotal * 0.9;
  const allCategorized = transactions.filter((t) => !t.category).length === 0;
  const noNewDebt = true;
  const upcomingCovered = true;

  const stewardship_score = scoreStewardship({
    givingHonored,
    savingsHonored,
    livedWithinProvision,
    allCategorized,
    noNewDebt,
    upcomingCovered,
  });

  const goalProgress = goals.map((g) => ({
    name: g.name,
    contributed: 0,
    on_track: !g.deadline || new Date(g.deadline).getTime() > Date.now(),
  }));

  const reportData = {
    week_start: weekStartStr,
    income_total: incomeTotal,
    spending_total: spendingTotal,
    giving_total: givingTotal,
    net_position: incomeTotal - spendingTotal,
    lived_within_provision: livedWithinProvision,
    top_categories: topCategories,
    giving_honored: givingHonored,
    savings_honored: savingsHonored,
    biggest_transaction: biggestTx ? { merchant: biggestTx.merchant, amount: Math.abs(Number(biggestTx.amount)), category: biggestTx.category } : null,
    goal_progress: goalProgress,
    stewardship_score,
  };

  // Generate solomon_word via Claude
  let solomonWord = "";
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: `You are Solomon, the wise financial analyst for Steward Money. You speak with wisdom rooted in biblical stewardship — giving first, intentional saving, living within provision, full accountability for every dollar. You are direct, not preachy. Wise, not religious. You speak like a mentor who genuinely cares. 2-3 sentences maximum. Be specific to their numbers.`,
      messages: [{
        role: "user",
        content: `Here is this week's financial data for ${displayName}:\n${JSON.stringify(reportData, null, 2)}\n\nWrite 2-3 sentences of genuine wisdom for this week. Be specific to their numbers. Reference what they did well and what needs attention. Sound like a mentor.`,
      }],
    });
    solomonWord = msg.content.find((c) => c.type === "text")?.text ?? "";
  } catch {
    solomonWord = livedWithinProvision
      ? "You stayed within provision this week — that's the foundation. Keep that consistency and your goals will follow."
      : "Spending exceeded income this week. Identify the category that drove it and give every dollar a purpose next week.";
  }

  const fullReport = { ...reportData, solomon_word: solomonWord, user_id: userId };

  // Upsert — one report per week per user
  const { data: existing } = await supabase
    .from("weekly_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStartStr)
    .maybeSingle();

  if (existing) {
    await supabase.from("weekly_reports").update(fullReport).eq("id", existing.id);
  } else {
    await supabase.from("weekly_reports").insert(fullReport);
  }

  return fullReport;
}

export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    const admin = createAdminClient();
    const { data: users } = await admin.from("user_settings").select("user_id").eq("onboarding_completed", true).limit(200);
    const results = [];
    for (const u of users ?? []) {
      try {
        const report = await runSolomon(admin as ReturnType<typeof createClient>, u.user_id);
        results.push({ user_id: u.user_id, score: report.stewardship_score });
      } catch (err) {
        results.push({ user_id: u.user_id, error: String(err) });
      }
    }
    return NextResponse.json({ ok: true, processed: results.length });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const report = await runSolomon(supabase, user.id);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start", weekStartStr)
    .maybeSingle();

  return NextResponse.json({ report: data });
}

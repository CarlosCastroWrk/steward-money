import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Insight = {
  user_id: string;
  insight_type: string;
  insight_text: string;
  data: Record<string, unknown>;
  confidence_score: number;
  is_active: boolean;
  is_dismissed: boolean;
  expires_at: string;
};

async function runSilas(supabase: ReturnType<typeof createClient>, userId: string): Promise<Insight[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0];
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86_400_000).toISOString().split("T")[0];
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [txRes, subsRes, incomeRes, settingsRes] = await Promise.all([
    supabase.from("transactions").select("date, amount, category, merchant").eq("user_id", userId).gte("date", sixtyDaysAgo).lt("amount", 0),
    supabase.from("subscriptions").select("name, amount, status").eq("user_id", userId).eq("status", "keep"),
    supabase.from("income_sources").select("next_expected_date, next_date").eq("user_id", userId).eq("is_active", true),
    supabase.from("user_settings").select("giving_enabled").eq("user_id", userId).maybeSingle(),
  ]);

  const transactions = txRes.data ?? [];
  if (transactions.length < 10) return [];

  const insights: Insight[] = [];
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Pattern 1 — Weekend spending surge
  const weekendTx = transactions.filter((t) => { const d = new Date(t.date).getDay(); return d === 0 || d === 6; });
  const weekdayTx = transactions.filter((t) => { const d = new Date(t.date).getDay(); return d >= 1 && d <= 5; });
  const weekendAvg = weekendTx.length > 0 ? weekendTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0) / weekendTx.length : 0;
  const weekdayAvg = weekdayTx.length > 0 ? weekdayTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0) / weekdayTx.length : 0;
  if (weekdayAvg > 0 && weekendAvg > weekdayAvg * 2) {
    insights.push({
      user_id: userId, insight_type: "weekend_surge",
      insight_text: `You spend significantly more on weekends — plan for this in your weekly allocation.`,
      data: { weekend_avg: weekendAvg, weekday_avg: weekdayAvg },
      confidence_score: 0.85, is_active: true, is_dismissed: false, expires_at: expiresAt,
    });
  }

  // Pattern 2 — Post-paycheck surge
  const incomeDates = (incomeRes.data ?? []).map((i) => i.next_expected_date || i.next_date).filter(Boolean) as string[];
  if (incomeDates.length > 0) {
    const latestPayday = incomeDates.sort().pop()!;
    const paydayMs = new Date(latestPayday).getTime();
    const post3days = transactions.filter((t) => {
      const ms = new Date(t.date).getTime();
      return ms >= paydayMs && ms <= paydayMs + 3 * 86_400_000;
    });
    const pre3days = transactions.filter((t) => {
      const ms = new Date(t.date).getTime();
      return ms >= paydayMs - 3 * 86_400_000 && ms < paydayMs;
    });
    const postTotal = post3days.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const preTotal = pre3days.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    if (preTotal > 0 && postTotal > preTotal * 1.5) {
      insights.push({
        user_id: userId, insight_type: "paycheck_surge",
        insight_text: `Your spending jumps right after payday. Consider allocating your paycheck immediately when it lands — give every dollar a job first.`,
        data: { post_total: postTotal, pre_total: preTotal },
        confidence_score: 0.8, is_active: true, is_dismissed: false, expires_at: expiresAt,
      });
    }
  }

  // Pattern 3 — Category trending up
  const recent30 = transactions.filter((t) => t.date >= thirtyDaysAgo);
  const prior30 = transactions.filter((t) => t.date >= sixtyDaysAgo && t.date < thirtyDaysAgo);
  const catRecent = new Map<string, number>();
  const catPrior = new Map<string, number>();
  for (const t of recent30) { const k = t.category ?? "Other"; catRecent.set(k, (catRecent.get(k) ?? 0) + Math.abs(Number(t.amount))); }
  for (const t of prior30) { const k = t.category ?? "Other"; catPrior.set(k, (catPrior.get(k) ?? 0) + Math.abs(Number(t.amount))); }
  for (const [cat, amount] of catRecent.entries()) {
    const prior = catPrior.get(cat) ?? 0;
    if (prior > 0 && amount > prior * 1.3) {
      const pct = Math.round(((amount - prior) / prior) * 100);
      insights.push({
        user_id: userId, insight_type: "category_trending",
        insight_text: `${cat} spending is up ${pct}% from last month.`,
        data: { category: cat, recent: amount, prior, pct },
        confidence_score: 0.75, is_active: true, is_dismissed: false, expires_at: expiresAt,
      });
      break;
    }
  }

  // Pattern 4 — Unused subscription
  for (const sub of subsRes.data ?? []) {
    const recentMerchants = transactions
      .filter((t) => t.date >= fortyFiveDaysAgo)
      .map((t) => (t.merchant ?? "").toLowerCase());
    const subName = sub.name.toLowerCase();
    const used = recentMerchants.some((m) => m.includes(subName) || subName.includes(m.split(" ")[0]));
    if (!used) {
      insights.push({
        user_id: userId, insight_type: "unused_subscription",
        insight_text: `You may not be using ${sub.name}. Worth reviewing — that's ${fmt(Number(sub.amount))}/month.`,
        data: { subscription: sub.name, amount: sub.amount },
        confidence_score: 0.7, is_active: true, is_dismissed: false, expires_at: expiresAt,
      });
      break;
    }
  }

  // Pattern 5 — Positive: consistent giving
  if (settingsRes.data?.giving_enabled) {
    const givingTx = transactions.filter((t) =>
      ["giving", "tithe", "donation"].some((k) => (t.category ?? "").toLowerCase().includes(k))
    );
    if (givingTx.length >= 4) {
      insights.push({
        user_id: userId, insight_type: "consistent_giving",
        insight_text: `Giving has been honored consistently this month. First fruits, first priority.`,
        data: { count: givingTx.length },
        confidence_score: 0.95, is_active: true, is_dismissed: false, expires_at: expiresAt,
      });
    }
  }

  return insights.slice(0, 5);
}

export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    const admin = createAdminClient();
    const { data: users } = await admin.from("user_settings").select("user_id").eq("onboarding_completed", true).limit(200);
    let processed = 0;
    for (const u of users ?? []) {
      try {
        const insights = await runSilas(admin as ReturnType<typeof createClient>, u.user_id);
        await admin.from("pulse_insights").update({ is_active: false }).eq("user_id", u.user_id);
        if (insights.length > 0) await admin.from("pulse_insights").insert(insights);
        processed++;
      } catch { /* continue */ }
    }
    return NextResponse.json({ ok: true, processed });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const insights = await runSilas(supabase, user.id);

  await supabase.from("pulse_insights").update({ is_active: false }).eq("user_id", user.id).eq("is_dismissed", false);
  if (insights.length > 0) await supabase.from("pulse_insights").insert(insights);

  return NextResponse.json({ ok: true, insights });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("pulse_insights")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_dismissed", false)
    .order("confidence_score", { ascending: false })
    .limit(2);

  return NextResponse.json({ insights: data ?? [] });
}

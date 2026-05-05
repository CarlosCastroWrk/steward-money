import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type KairosEvent = {
  user_id: string;
  event_type: string;
  event_description: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
};

async function detectKairosEvents(supabase: ReturnType<typeof createClient>, userId: string): Promise<KairosEvent[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [incomeRes, safeRes, goalsRes, monthlySpendRes, priorMonthSpendRes] = await Promise.all([
    supabase.from("income_sources").select("amount, frequency").eq("user_id", userId).eq("is_active", true),
    supabase.from("transactions").select("amount, date").eq("user_id", userId).lt("amount", 0).gte("date", sevenDaysAgo),
    supabase.from("goals").select("name, target_amount, current_amount").eq("user_id", userId),
    supabase.from("transactions").select("amount").eq("user_id", userId).lt("amount", 0).gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
    supabase.from("transactions").select("amount").eq("user_id", userId).lt("amount", 0).gte("date", new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0]).lt("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
  ]);

  const events: KairosEvent[] = [];

  // Check: goal completed
  for (const g of goalsRes.data ?? []) {
    if (g.current_amount >= g.target_amount && g.target_amount > 0) {
      events.push({
        user_id: userId,
        event_type: "goal_completed",
        event_description: `Goal "${g.name}" has been completed — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(g.target_amount)} reached.`,
        new_value: { goal_name: g.name, target: g.target_amount },
      });
    }
  }

  // Check: safe-to-spend negative 7+ consecutive days
  const negativeDays = (safeRes.data ?? []).filter((t) => Number(t.amount) < 0);
  if (negativeDays.length >= 7) {
    events.push({
      user_id: userId,
      event_type: "persistent_negative_balance",
      event_description: "Safe-to-spend has been negative for an extended period. A plan review may help.",
    });
  }

  // Check: monthly spending shift > 35%
  const thisMonthTotal = (monthlySpendRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const priorMonthTotal = (priorMonthSpendRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  if (priorMonthTotal > 0 && Math.abs(thisMonthTotal - priorMonthTotal) / priorMonthTotal > 0.35) {
    events.push({
      user_id: userId,
      event_type: "spending_shift",
      event_description: `Monthly spending has shifted significantly from last month.`,
      old_value: { prior_month_total: priorMonthTotal },
      new_value: { this_month_total: thisMonthTotal },
    });
  }

  return events;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const manualReason: string | undefined = body.reason;

  const events: KairosEvent[] = [];

  if (manualReason) {
    events.push({
      user_id: user.id,
      event_type: "user_triggered",
      event_description: manualReason,
    });
  } else {
    const detected = await detectKairosEvents(supabase, user.id);
    events.push(...detected);
  }

  if (events.length > 0) {
    await supabase.from("life_events").insert(events);
    await supabase.from("user_settings").update({ kairos_pending: true }).eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, events_detected: events.length, events });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("kairos_pending, last_plan_review")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: recentEvents } = await supabase
    .from("life_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("acknowledged", false)
    .order("detected_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    kairos_pending: settings?.kairos_pending ?? false,
    last_plan_review: settings?.last_plan_review ?? null,
    events: recentEvents ?? [],
  });
}

export async function PATCH() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("life_events").update({ acknowledged: true }).eq("user_id", user.id).eq("acknowledged", false);
  await supabase.from("user_settings").update({ kairos_pending: false, last_plan_review: new Date().toISOString() }).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

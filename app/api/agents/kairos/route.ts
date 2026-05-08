import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveAgentMemory } from "@/lib/agent-memory";
import { getUpcomingEvents } from "@/lib/calendar-context";
import { formatDate } from "@/lib/format";

type KairosEvent = {
  user_id: string;
  event_type: string;
  event_description: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
};

interface ClarificationChoice {
  label: string;
  event_type: string;
  category: string;
}

interface ClarificationCard {
  id: string;
  card_type: "clarify" | "confirm_expense" | "recurring_pattern";
  event_cache_id: string;
  event_title: string;
  event_date: string;
  question: string;
  choices: ClarificationChoice[];
}

async function detectKairosEvents(supabase: ReturnType<typeof createClient>, userId: string): Promise<KairosEvent[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [incomeRes, safeRes, goalsRes, monthlySpendRes, priorMonthSpendRes] = await Promise.all([
    supabase.from("income_sources").select("amount, frequency").eq("user_id", userId).eq("is_active", true),
    supabase.from("transactions").select("amount, date").eq("user_id", userId).lt("amount", 0).gte("date", sevenDaysAgo),
    supabase.from("goals").select("name, target_amount, current_amount").eq("user_id", userId),
    supabase.from("transactions").select("amount").eq("user_id", userId).lt("amount", 0).gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
    supabase.from("transactions").select("amount").eq("user_id", userId).lt("amount", 0).gte("date", new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0]).lt("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
  ]);

  // suppress unused var warning
  void incomeRes; void today;

  const events: KairosEvent[] = [];

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

  const negativeDays = (safeRes.data ?? []).filter((t) => Number(t.amount) < 0);
  if (negativeDays.length >= 7) {
    events.push({
      user_id: userId,
      event_type: "persistent_negative_balance",
      event_description: "Safe-to-spend has been negative for an extended period. A plan review may help.",
    });
  }

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

function buildClarifyQuestion(title: string, dateLabel: string): string {
  return `You have "${title}" ${dateLabel}. Are you working that one or attending?`;
}

function buildExpenseQuestion(title: string, dateLabel: string): string {
  return `"${title}" is coming up ${dateLabel}. Do you usually pay out of pocket for this?`;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const manualReason: string | undefined = body.reason;

  const events: KairosEvent[] = [];

  if (manualReason) {
    events.push({ user_id: user.id, event_type: "user_triggered", event_description: manualReason });
  } else {
    const detected = await detectKairosEvents(supabase, user.id);
    events.push(...detected);
  }

  if (events.length > 0) {
    await supabase.from("life_events").insert(events);
    await supabase.from("user_settings").update({ kairos_pending: true }).eq("user_id", user.id);
    await saveAgentMemory(supabase, user.id, "kairos",
      `Detected ${events.length} life event(s): ${events.map((e) => e.event_type).join(", ")}. Plan review pending.`,
      9
    );
  }

  return NextResponse.json({ ok: true, events_detected: events.length, events });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settingsRes, lifeEventsRes, calendarEvents] = await Promise.all([
    supabase.from("user_settings").select("kairos_pending, last_plan_review").eq("user_id", user.id).maybeSingle(),
    supabase.from("life_events").select("*").eq("user_id", user.id).eq("acknowledged", false).order("detected_at", { ascending: false }).limit(5),
    getUpcomingEvents(supabase, user.id, 21),
  ]);

  const now = Date.now();

  // ── Calendar insights (confirmed events only) ───────────────────────────
  const calendarInsights: Array<{
    id: string; type: string; headline: string; detail: string; event_date: string; spending_estimate: number;
  }> = [];

  for (const event of calendarEvents) {
    if (!event.title) continue;

    const daysAway = Math.ceil((new Date(event.start_time).getTime() - now) / 86_400_000);
    const dateLabel = formatDate(event.start_time.split("T")[0]);
    const isConfirmedExpense = event.event_type === "expense" && event.user_confirmed;
    const isIncome = event.event_type === "income" || event.is_income_event;

    if (isConfirmedExpense && event.spending_estimate >= 100) {
      calendarInsights.push({
        id: `cal-${event.id}`,
        type: "big_expense",
        headline: `${event.title} in ${daysAway} day${daysAway !== 1 ? "s" : ""} · ~$${event.spending_estimate.toFixed(0)}`,
        detail: `${dateLabel}${event.analysis_notes ? ` — ${event.analysis_notes}` : ""}. Want to plan ahead?`,
        event_date: event.start_time,
        spending_estimate: event.spending_estimate,
      });
    } else if (isIncome) {
      calendarInsights.push({
        id: `cal-${event.id}`,
        type: "income_event",
        headline: `${event.title} · ${dateLabel}`,
        detail: "Work event coming up. Any prep needed?",
        event_date: event.start_time,
        spending_estimate: 0,
      });
    } else if (event.category === "travel" && isConfirmedExpense) {
      calendarInsights.push({
        id: `cal-${event.id}`,
        type: "travel",
        headline: `${event.title} · ${dateLabel}`,
        detail: "Travel weeks tend to run higher than normal. Want to plan ahead?",
        event_date: event.start_time,
        spending_estimate: event.spending_estimate,
      });
    }
  }

  // Busy season card — only if enough events in next 14 days
  const busyEvents = calendarEvents.filter((e) => {
    const days = (new Date(e.start_time).getTime() - now) / 86_400_000;
    return days >= 0 && days <= 14;
  });
  if (busyEvents.length >= 5 && calendarInsights.length < 3) {
    calendarInsights.push({
      id: "cal-busy-season",
      type: "busy_season",
      headline: `You've got ${busyEvents.length} events in the next 2 weeks`,
      detail: "Busy schedules usually mean unplanned spending. Want to review your buffer?",
      event_date: busyEvents[0].start_time,
      spending_estimate: 0,
    });
  }

  // ── Clarification cards for ambiguous events ────────────────────────────
  const clarificationCards: ClarificationCard[] = [];

  // Find events needing clarification in the next 14 days
  const ambiguousEvents = calendarEvents.filter((e) =>
    e.title &&
    !e.user_confirmed &&
    (new Date(e.start_time).getTime() - now) / 86_400_000 <= 14 &&
    (e.event_type === "needs_clarification" || (e.event_type === "expense" && !e.user_confirmed))
  );

  for (const event of ambiguousEvents.slice(0, 3)) {
    if (!event.title) continue;
    const dateLabel = formatDate(event.start_time.split("T")[0]).toLowerCase();

    if (event.event_type === "needs_clarification") {
      clarificationCards.push({
        id: `clarify-${event.id}`,
        card_type: "clarify",
        event_cache_id: event.id,
        event_title: event.title,
        event_date: event.start_time,
        question: buildClarifyQuestion(event.title, dateLabel),
        choices: [
          { label: "Working — I get paid", event_type: "income", category: "work" },
          { label: "Attending — might spend", event_type: "expense", category: "entertainment" },
          { label: "Just a hangout", event_type: "social", category: "social" },
        ],
      });
    } else if (event.event_type === "expense" && !event.user_confirmed) {
      clarificationCards.push({
        id: `clarify-${event.id}`,
        card_type: "confirm_expense",
        event_cache_id: event.id,
        event_title: event.title,
        event_date: event.start_time,
        question: buildExpenseQuestion(event.title, dateLabel),
        choices: [
          { label: "Yes, out of pocket", event_type: "expense", category: event.category ?? "health" },
          { label: "Covered / free", event_type: "personal", category: "personal" },
          { label: "Not sure", event_type: "needs_clarification", category: "other" },
        ],
      });
    }
  }

  // Recurring pattern card: 3+ unconfirmed events with the same first word
  const titleGroups: Map<string, typeof calendarEvents> = new Map();
  for (const e of calendarEvents) {
    if (!e.title || e.user_confirmed) continue;
    const key = e.title.split(/\s+/)[0].toLowerCase();
    if (key.length < 3) continue;
    const existing = titleGroups.get(key) ?? [];
    existing.push(e);
    titleGroups.set(key, existing);
  }

  for (const [key, group] of titleGroups.entries()) {
    if (group.length >= 3 && clarificationCards.length < 4) {
      const sample = group[0];
      clarificationCards.push({
        id: `pattern-${key}`,
        card_type: "recurring_pattern",
        event_cache_id: sample.id,
        event_title: sample.title ?? key,
        event_date: sample.start_time,
        question: `You have ${group.length} "${sample.title?.split(/\s+/)[0] ?? key}" events coming up. Want me to track all of these as work?`,
        choices: [
          { label: "Yes — all work", event_type: "income", category: "work" },
          { label: "No — ask each time", event_type: "needs_clarification", category: "other" },
        ],
      });
      break; // one pattern card max
    }
  }

  return NextResponse.json({
    kairos_pending: settingsRes.data?.kairos_pending ?? false,
    last_plan_review: settingsRes.data?.last_plan_review ?? null,
    events: lifeEventsRes.data ?? [],
    calendar_insights: calendarInsights.slice(0, 4),
    clarification_cards: clarificationCards,
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

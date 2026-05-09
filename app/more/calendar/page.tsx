import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/calendar/CalendarView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams?: { date?: string } }) {
  const focusDate = searchParams?.date ?? null;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  const past30 = new Date(today.getTime() - 30 * 86_400_000);
  const future90 = new Date(today.getTime() + 90 * 86_400_000);

  const [
    { data: calConnRow },
    { data: calEvents },
    { data: bills },
    { data: incomeSources },
    { data: transactions },
    { data: goals },
  ] = await Promise.all([
    supabase.from("calendar_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("calendar_events_cache")
      .select("id, title, start_time, event_type, spending_estimate, user_confirmed, category, is_income_event")
      .eq("user_id", user.id)
      .gte("start_time", past30.toISOString())
      .lte("start_time", future90.toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("bills").select("id, name, amount, next_due_date").eq("user_id", user.id).not("next_due_date", "is", null),
    supabase.from("income_sources").select("id, name, amount, next_expected_date, frequency").eq("user_id", user.id).eq("is_active", true).not("next_expected_date", "is", null),
    supabase
      .from("transactions")
      .select("id, date, merchant, amount, category")
      .eq("user_id", user.id)
      .gte("date", past30.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, deadline")
      .eq("user_id", user.id)
      .not("deadline", "is", null),
  ]);

  return (
    <CalendarView
      calendarConnected={!!calConnRow}
      calEvents={calEvents ?? []}
      bills={bills ?? []}
      incomeSources={incomeSources ?? []}
      transactions={transactions ?? []}
      goals={goals ?? []}
      focusDate={focusDate}
    />
  );
}

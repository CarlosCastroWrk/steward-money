import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/format";

export interface CalendarEvent {
  id: string;
  title: string | null;
  start_time: string;
  spending_estimate: number;
  financial_relevance_score: number;
  category: string | null;
  is_income_event: boolean;
  analysis_notes: string | null;
  location: string | null;
  event_type: "income" | "expense" | "social" | "personal" | "needs_clarification" | null;
  confidence: "high" | "medium" | "low" | null;
  user_confirmed: boolean;
}

export async function getUpcomingEvents(
  supabase: SupabaseClient,
  userId: string,
  daysAhead = 30
): Promise<CalendarEvent[]> {
  const { data: conn } = await supabase
    .from("calendar_connections")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return [];

  const now = new Date().toISOString();
  const future = new Date(Date.now() + daysAhead * 86_400_000).toISOString();

  const { data } = await supabase
    .from("calendar_events_cache")
    .select("id, title, start_time, spending_estimate, financial_relevance_score, category, is_income_event, analysis_notes, location, event_type, confidence, user_confirmed")
    .eq("user_id", userId)
    .gte("start_time", now)
    .lte("start_time", future)
    .order("start_time", { ascending: true })
    .limit(20);

  return (data ?? []) as CalendarEvent[];
}

// Builds a terse plain-text summary for agent system prompts.
// Only surfaces confirmed costs — doesn't guess on ambiguous events.
export function formatCalendarContextForAgent(events: CalendarEvent[]): string {
  if (events.length === 0) return "";

  const lines = events.map((e) => {
    const dateStr = formatDate(e.start_time.split("T")[0]);
    const isIncome = e.event_type === "income" || e.is_income_event;
    const isConfirmedExpense = e.event_type === "expense" && e.user_confirmed;
    const costStr = isConfirmedExpense && e.spending_estimate > 0
      ? ` (confirmed ~$${e.spending_estimate.toFixed(0)})`
      : isIncome ? " (earning)" : "";
    const notesStr = e.analysis_notes ? ` — ${e.analysis_notes}` : "";
    return `- ${e.title ?? "Untitled event"} · ${dateStr}${costStr}${notesStr}`;
  });

  return `UPCOMING CALENDAR EVENTS (next ${Math.ceil((new Date(events[events.length - 1].start_time).getTime() - Date.now()) / 86_400_000)} days):\n${lines.join("\n")}\n\nWhen referencing these events, ask before assuming financial impact. For any event that isn't explicitly confirmed as income or expense, ask rather than guess.`;
}

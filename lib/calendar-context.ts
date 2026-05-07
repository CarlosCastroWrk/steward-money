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
    .select("id, title, start_time, spending_estimate, financial_relevance_score, category, is_income_event, analysis_notes, location")
    .eq("user_id", userId)
    .gte("start_time", now)
    .lte("start_time", future)
    .order("start_time", { ascending: true })
    .limit(20);

  return (data ?? []) as CalendarEvent[];
}

// Builds a terse plain-text summary for injecting into agent system prompts
export function formatCalendarContextForAgent(events: CalendarEvent[]): string {
  if (events.length === 0) return "";

  const lines = events.map((e) => {
    const dateStr = formatDate(e.start_time.split("T")[0]);
    const costStr = e.spending_estimate > 0 ? ` (est. $${e.spending_estimate.toFixed(0)})` : "";
    const notesStr = e.analysis_notes ? ` — ${e.analysis_notes}` : "";
    return `- ${e.title ?? "Untitled event"} · ${dateStr}${costStr}${notesStr}`;
  });

  return `UPCOMING CALENDAR EVENTS (next ${Math.ceil((new Date(events[events.length - 1].start_time).getTime() - Date.now()) / 86_400_000)} days):\n${lines.join("\n")}\n\nWhen relevant, reference these events naturally. Don't list them unprompted — weave them in when they connect to what the user is asking about.`;
}

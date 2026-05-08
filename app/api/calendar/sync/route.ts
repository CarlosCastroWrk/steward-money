import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic();

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

type EventType = "income" | "expense" | "social" | "personal" | "needs_clarification";
type Confidence = "high" | "medium" | "low";

interface Classification {
  event_type: EventType;
  confidence: Confidence;
  category: string;
  cost_estimate: number | null;
  is_income_event: boolean;
  analysis_notes: string;
}

interface CalendarPattern {
  pattern_match: string;
  event_type: string;
  category: string;
  confidence: number;
}

async function refreshTokenIfNeeded(supabase: ReturnType<typeof createClient>, userId: string, conn: { access_token: string; refresh_token: string | null; expires_at: string | null }) {
  if (!conn.expires_at) return conn.access_token;
  const expiresAt = new Date(conn.expires_at);
  if (expiresAt.getTime() - Date.now() > 5 * 60_000) return conn.access_token;

  if (!conn.refresh_token || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return conn.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return conn.access_token;
  const data = await res.json();

  await supabase.from("calendar_connections").update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("user_id", userId);

  return data.access_token as string;
}

function matchesPattern(title: string, patterns: CalendarPattern[]): CalendarPattern | null {
  const lower = title.toLowerCase();
  for (const p of patterns) {
    if (lower.includes(p.pattern_match.toLowerCase())) return p;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(user.id, "/api/calendar/sync");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { data: conn } = await supabase
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conn) return NextResponse.json({ error: "Calendar not connected" }, { status: 400 });

  const accessToken = await refreshTokenIfNeeded(supabase, user.id, conn);

  const now = new Date().toISOString();
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString();

  const googleRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${in60Days}&singleEvents=true&orderBy=startTime&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!googleRes.ok) {
    return NextResponse.json({ error: "Google Calendar API error", status: googleRes.status }, { status: 502 });
  }

  const calData = await googleRes.json();
  const rawEvents: GoogleCalendarEvent[] = calData.items ?? [];

  if (rawEvents.length === 0) {
    return NextResponse.json({ ok: true, events: [], classified: 0 });
  }

  // Load user's learned patterns for instant categorization
  const { data: patternsData } = await supabase
    .from("calendar_patterns")
    .select("pattern_match, event_type, category, confidence")
    .eq("user_id", user.id)
    .order("match_count", { ascending: false });

  const patterns: CalendarPattern[] = (patternsData ?? []) as CalendarPattern[];

  const eventsToProcess = rawEvents.slice(0, 20);

  // Separate events that already match a pattern from those needing AI
  const patternMatched: Map<number, Classification> = new Map();
  const needsAI: { index: number; event: GoogleCalendarEvent }[] = [];

  for (let i = 0; i < eventsToProcess.length; i++) {
    const e = eventsToProcess[i];
    const title = e.summary ?? "";
    const match = title ? matchesPattern(title, patterns) : null;

    if (match && match.confidence >= 0.85) {
      patternMatched.set(i, {
        event_type: match.event_type as EventType,
        confidence: "high",
        category: match.category,
        cost_estimate: null,
        is_income_event: match.event_type === "income",
        analysis_notes: `Auto-categorized from learned pattern.`,
      });
    } else {
      needsAI.push({ index: i, event: e });
    }
  }

  // AI classification for events without a pattern match
  const aiResults: Map<number, Classification> = new Map();

  if (needsAI.length > 0) {
    const eventList = needsAI.map(({ event: e }) => {
      const parts = [`"${e.summary ?? "Untitled"}"`];
      if (e.start?.dateTime ?? e.start?.date) parts.push(`on ${e.start?.dateTime ?? e.start?.date}`);
      if (e.location) parts.push(`at ${e.location}`);
      if (e.description) parts.push(`(${e.description.slice(0, 100)})`);
      return parts.join(" ");
    }).join("\n");

    const classifyMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Classify each calendar event for a personal finance app. Be conservative — when uncertain, use needs_clarification.

Categories:
- income: user is working/earning (shifts, refereeing, freelance gigs, paid speaking)
- expense: clear spending event with specific cost signals (named restaurant reservation, medical with copay, hotel, flight)
- social: casual hangout, coffee with friend, birthday party — could go either way, low stakes
- personal: no money implication (workout, meditation, family time at home, religious service)
- needs_clarification: ambiguous name, missing context, could be income OR expense

RULES:
- Only set cost_estimate if event_type="expense" AND confidence="high" AND event has a specific named business location
- When in doubt: needs_clarification, never guess costs
- Work events (shifts, gigs, tournaments the user is running) = income
- Casual social events = social, NOT expense

Return a JSON array (same order as input) with objects:
{ "event_type": string, "confidence": "high"|"medium"|"low", "category": string, "cost_estimate": number|null, "is_income_event": boolean, "analysis_notes": string }

Events:
${eventList}

Return ONLY the JSON array, no other text.`,
      }],
    });

    let parsed: Classification[] = [];
    try {
      const text = (classifyMsg.content[0] as { type: string; text: string }).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch { /* use defaults */ }

    needsAI.forEach(({ index }, arrIdx) => {
      const c = parsed[arrIdx];
      if (c) {
        aiResults.set(index, {
          event_type: (c.event_type as EventType) ?? "needs_clarification",
          confidence: (c.confidence as Confidence) ?? "low",
          category: c.category ?? "other",
          cost_estimate: c.cost_estimate ?? null,
          is_income_event: c.is_income_event ?? false,
          analysis_notes: c.analysis_notes ?? "",
        });
      }
    });
  }

  // Upsert events — preserve user_confirmed if event already exists
  const rows = eventsToProcess.map((e, i) => {
    const cls = patternMatched.get(i) ?? aiResults.get(i) ?? {
      event_type: "needs_clarification" as EventType,
      confidence: "low" as Confidence,
      category: "other",
      cost_estimate: null,
      is_income_event: false,
      analysis_notes: "",
    };

    return {
      user_id: user.id,
      event_id: e.id,
      title: e.summary ?? null,
      start_time: e.start?.dateTime ?? e.start?.date ?? null,
      end_time: e.end?.dateTime ?? e.end?.date ?? null,
      description: e.description ?? null,
      location: e.location ?? null,
      spending_estimate: cls.cost_estimate ?? 0,
      category: cls.category,
      is_income_event: cls.is_income_event,
      event_type: cls.event_type,
      confidence: cls.confidence,
      financial_relevance_score: cls.event_type === "expense" || cls.event_type === "income" ? 0.7 : 0.2,
      analysis_notes: cls.analysis_notes || null,
      synced_at: new Date().toISOString(),
    };
  });

  for (const row of rows) {
    // Don't overwrite user_confirmed events with AI guesses
    await supabase
      .from("calendar_events_cache")
      .upsert(row, { onConflict: "user_id,event_id", ignoreDuplicates: false })
      .eq("user_confirmed", false);
  }

  return NextResponse.json({ ok: true, synced: rows.length, events: rows });
}

// GET — return cached events
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("calendar_events_cache")
    .select("id, title, start_time, end_time, spending_estimate, category, is_income_event, event_type, confidence, user_confirmed")
    .eq("user_id", user.id)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(20);

  return NextResponse.json({ events: data ?? [] });
}

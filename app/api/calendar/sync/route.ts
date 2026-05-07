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

  // Classify events with Claude in a single batch call
  const eventSummaries = rawEvents
    .slice(0, 20)
    .map((e) => `"${e.summary ?? "Untitled"}" on ${e.start?.dateTime ?? e.start?.date ?? "?"}${e.location ? ` at ${e.location}` : ""}`)
    .join("\n");

  const classifyMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `Classify each calendar event for its financial impact. For each, return a JSON array (same order as input) with:
- spending_estimate: number (0 if not a spending event, estimated $ cost in USD if yes — be realistic)
- is_income_event: boolean
- category: string (one of: dining, entertainment, travel, personal_care, health, work, social, gift, family, other, income)
- financial_relevance_score: number 0.0-1.0 (0 = no financial impact, 1 = major financial event)
- analysis_notes: string (1 short sentence on financial implication, or empty string if irrelevant)

Events:
${eventSummaries}

Return ONLY a JSON array of objects, no other text.`,
    }],
  });

  let classifications: Array<{ spending_estimate: number; is_income_event: boolean; category: string; financial_relevance_score: number; analysis_notes: string }> = [];
  try {
    const text = (classifyMsg.content[0] as { type: string; text: string }).text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) classifications = JSON.parse(jsonMatch[0]);
  } catch { /* use empty defaults */ }

  // Upsert events to cache
  const rows = rawEvents.slice(0, 20).map((e, i) => ({
    user_id: user.id,
    event_id: e.id,
    title: e.summary ?? null,
    start_time: e.start?.dateTime ?? e.start?.date ?? null,
    end_time: e.end?.dateTime ?? e.end?.date ?? null,
    description: e.description ?? null,
    location: e.location ?? null,
    spending_estimate: classifications[i]?.spending_estimate ?? 0,
    category: classifications[i]?.category ?? "other",
    is_income_event: classifications[i]?.is_income_event ?? false,
    financial_relevance_score: classifications[i]?.financial_relevance_score ?? 0,
    analysis_notes: classifications[i]?.analysis_notes ?? null,
    synced_at: new Date().toISOString(),
  }));

  for (const row of rows) {
    await supabase.from("calendar_events_cache").upsert(row, { onConflict: "user_id,event_id" });
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
    .select("id, title, start_time, end_time, spending_estimate, category, is_income_event")
    .eq("user_id", user.id)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(20);

  return NextResponse.json({ events: data ?? [] });
}

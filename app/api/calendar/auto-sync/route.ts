import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { isCronAuthorized } from "@/lib/cron-auth";

const anthropic = new Anthropic();

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

async function refreshToken(conn: { access_token: string; refresh_token: string | null; expires_at: string | null }): Promise<string> {
  if (!conn.expires_at) return conn.access_token;
  if (new Date(conn.expires_at).getTime() - Date.now() > 5 * 60_000) return conn.access_token;
  if (!conn.refresh_token) return conn.access_token;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return conn.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return conn.access_token;
  const data = await res.json();
  return data.access_token ?? conn.access_token;
}

async function syncUserCalendar(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<number> {
  const { data: conn } = await admin
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) return 0;

  const accessToken = await refreshToken(conn);

  const now = new Date().toISOString();
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString();

  const googleRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(in60Days)}&singleEvents=true&orderBy=startTime&maxResults=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!googleRes.ok) return 0;

  const calData = await googleRes.json();
  const rawEvents: GoogleCalendarEvent[] = calData.items ?? [];
  if (rawEvents.length === 0) return 0;

  const eventSummaries = rawEvents
    .slice(0, 15)
    .map((e) => `"${e.summary ?? "Untitled"}" on ${e.start?.dateTime ?? e.start?.date ?? "?"}`)
    .join("\n");

  let classifications: Array<{ spending_estimate: number; is_income_event: boolean; category: string; financial_relevance_score: number; analysis_notes: string }> = [];
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Classify each calendar event for financial impact. Return a JSON array (same order) with: spending_estimate (number, USD), is_income_event (boolean), category (dining/entertainment/travel/personal_care/health/work/social/gift/family/other/income), financial_relevance_score (0.0-1.0), analysis_notes (1 sentence or empty). Events:\n${eventSummaries}\nReturn ONLY a JSON array.`,
      }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text;
    const match = text.match(/\[[\s\S]*\]/);
    if (match) classifications = JSON.parse(match[0]);
  } catch { /* silent */ }

  const rows = rawEvents.slice(0, 15).map((e, i) => ({
    user_id: userId,
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
    await admin.from("calendar_events_cache").upsert(row, { onConflict: "user_id,event_id" });
  }

  return rows.length;
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("calendar_connections")
    .select("user_id")
    .limit(500);

  const userIds = (connections ?? []).map((c: { user_id: string }) => c.user_id);
  let totalSynced = 0;

  for (const userId of userIds) {
    try {
      const count = await syncUserCalendar(admin, userId);
      totalSynced += count;
    } catch {
      // silently skip failed users
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, events_synced: totalSynced });
}

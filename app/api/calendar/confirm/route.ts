import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    event_id?: string;
    event_type?: string;
    category?: string;
    cost_estimate?: number;
  };

  const { event_id, event_type, category, cost_estimate } = body;

  if (!event_id || !event_type) {
    return NextResponse.json({ error: "event_id and event_type required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    event_type,
    user_confirmed: true,
    user_categorized_as: category ?? event_type,
    confidence: "high",
  };

  if (event_type === "income") {
    updates.is_income_event = true;
    updates.spending_estimate = 0;
  } else if (cost_estimate != null) {
    updates.spending_estimate = cost_estimate;
    updates.is_income_event = false;
  }

  const { data: updated, error } = await supabase
    .from("calendar_events_cache")
    .update(updates)
    .eq("id", event_id)
    .eq("user_id", user.id)
    .select("title")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Pattern learning: extract keyword, count confirmed matches, create pattern at threshold 3
  if (updated.title) {
    const keyword = extractKeyword(updated.title);

    if (keyword) {
      const { count } = await supabase
        .from("calendar_events_cache")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("user_confirmed", true)
        .eq("event_type", event_type)
        .ilike("title", `%${keyword}%`);

      if ((count ?? 0) >= 3) {
        const { data: existing } = await supabase
          .from("calendar_patterns")
          .select("id, match_count")
          .eq("user_id", user.id)
          .ilike("pattern_match", keyword)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("calendar_patterns")
            .update({ match_count: existing.match_count + 1, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase.from("calendar_patterns").insert({
            user_id: user.id,
            pattern_match: keyword,
            event_type,
            category: category ?? event_type,
            match_count: count ?? 3,
            confidence: 0.9,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// Extracts the most meaningful keyword from an event title for pattern matching.
// Uses the first significant word (3+ chars) that isn't a generic word.
function extractKeyword(title: string): string | null {
  const stopWords = new Set(["with", "and", "the", "for", "at", "to", "from", "a", "an"]);
  const words = title.toLowerCase().split(/\s+/);
  const significant = words.filter((w) => w.length >= 3 && !stopWords.has(w));
  // Return first 2 significant words joined, or just the first
  return significant.slice(0, 2).join(" ") || null;
}

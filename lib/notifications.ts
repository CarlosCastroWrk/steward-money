import type { SupabaseClient } from "@supabase/supabase-js";

export type NotifSeverity = "info" | "warning" | "danger";

interface NotifOptions {
  type: string;
  message: string;
  severity?: NotifSeverity;
  agent?: string;
  dedupWindowHours?: number; // skip insert if same type was inserted within this many hours
}

/**
 * Write a notification to the `alerts` table for a user.
 * Deduplicates by type within the specified window (default 24h).
 * Safe to call from any server-side route; no-ops on failure.
 */
export async function notify(
  supabase: SupabaseClient,
  userId: string,
  opts: NotifOptions
): Promise<void> {
  const {
    type,
    message,
    severity = "info",
    agent = "system",
    dedupWindowHours = 24,
  } = opts;

  try {
    const windowStart = new Date(Date.now() - dedupWindowHours * 3_600_000).toISOString();
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("alert_type", type)
      .gte("created_at", windowStart)
      .maybeSingle();

    if (!existing) {
      await supabase.from("alerts").insert({
        user_id: userId,
        type,
        alert_type: type,
        message,
        severity,
        agent,
        is_read: false,
      });
    }
  } catch {
    // Non-fatal — notifications should never break the caller
  }
}

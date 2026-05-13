import type { SupabaseClient } from "@supabase/supabase-js";

export type NotifSeverity = "info" | "warning" | "danger";

export type AlertDiagnostics = {
  error_code: string | null;
  error_type: string | null;
  error_message: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
};

interface NotifOptions {
  type: string;
  message: string;
  severity?: NotifSeverity;
  agent?: string;
  dedupWindowHours?: number;
  diagnostics?: AlertDiagnostics;
}

/**
 * Write a notification to the `alerts` table.
 * Deduplication is enforced at the DB level via a unique (user_id, dedup_key) constraint.
 * The dedup_key is deterministic: `${type}:${windowBucketStart}`, so concurrent callers
 * produce the same key and only one insert succeeds (the rest get error code 23505).
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
    diagnostics,
  } = opts;

  try {
    const windowMs = dedupWindowHours * 3_600_000;
    const bucketStart = Math.floor(Date.now() / windowMs) * windowMs;
    const dedupKey = `${type}:${bucketStart}`;

    const { error } = await supabase.from("alerts").insert({
      user_id: userId,
      type,
      alert_type: type,
      message,
      severity,
      agent,
      is_read: false,
      dedup_key: dedupKey,
      error_code:    diagnostics?.error_code    ?? null,
      error_type:    diagnostics?.error_type    ?? null,
      error_message: diagnostics?.error_message ?? null,
      request_id:    diagnostics?.request_id    ?? null,
      metadata:      diagnostics?.metadata      ?? null,
    });

    if (error) {
      if (error.code === "23505") return; // duplicate within dedup window — expected
      console.error("[notify] insert failed", error);
    }
  } catch {
    // Non-fatal — notifications must never break the caller
  }
}

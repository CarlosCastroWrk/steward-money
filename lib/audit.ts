import { SupabaseClient } from "@supabase/supabase-js";

type AuditEvent =
  | "login_success"
  | "bank_connected"
  | "bank_disconnected"
  | "calendar_connected"
  | "calendar_disconnected"
  | "settings_changed"
  | "agent_action"
  | "session_expired"
  | "onboarding_completed";

export async function logAuditEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: AuditEvent,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.from("security_audit_log").insert({
      user_id: userId,
      event_type: eventType,
      metadata: metadata ?? {},
    });
  } catch {
    // Audit logging is non-critical — never throw
  }
}

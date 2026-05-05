"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuditEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  login_success:         "Signed in",
  bank_connected:        "Bank connected",
  bank_disconnected:     "Bank disconnected",
  calendar_connected:    "Calendar connected",
  calendar_disconnected: "Calendar disconnected",
  settings_changed:      "Settings updated",
  agent_action:          "Agent ran",
  session_expired:       "Session expired",
  onboarding_completed:  "Onboarding completed",
};

export function SecuritySection() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("security_audit_log")
      .select("id, event_type, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { setEvents(data ?? []); setLoading(false); });
  }, []);

  async function exportData() {
    setExportLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [settings, accounts, bills, goals, transactions, income] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("bills").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("*").eq("user_id", user.id).limit(1000),
      supabase.from("income_sources").select("*").eq("user_id", user.id),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      settings: settings.data,
      accounts: accounts.data,
      bills: bills.data,
      goals: goals.data,
      transactions: transactions.data,
      income_sources: income.data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `steward-money-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  }

  async function deleteAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="space-y-4">
      {/* MFA info */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Two-Factor Authentication</h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Add an extra layer of security using an authenticator app (TOTP).
        </p>
        <a
          href="https://supabase.com/dashboard/project/_/auth/users"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          Manage in Supabase →
        </a>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h3>
        </div>
        {loading ? (
          <div className="space-y-2 px-5 pb-5">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg shimmer" />)}
          </div>
        ) : events.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-[var(--text-muted)]">No recent security events.</p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-[var(--text-secondary)]">
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data + account */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your Data</h3>
        <button
          type="button"
          onClick={exportData}
          disabled={exportLoading}
          className="w-full rounded-xl border border-[var(--border-default)] py-2.5 text-sm text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          {exportLoading ? "Exporting…" : "Export my data (JSON)"}
        </button>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full rounded-xl border border-[var(--color-danger)]/20 py-2.5 text-sm text-[var(--color-expense)] transition-all hover:border-[var(--color-danger)]/40"
          >
            Delete my account
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4">
            <p className="text-sm text-[var(--text-primary)] mb-3">This will sign you out. Contact support to fully delete data.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl border border-[var(--border-default)] py-2 text-sm text-[var(--text-secondary)]">Cancel</button>
              <button type="button" onClick={deleteAccount} className="flex-1 rounded-xl border border-[var(--color-danger)]/40 py-2 text-sm text-[var(--color-expense)]">Confirm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

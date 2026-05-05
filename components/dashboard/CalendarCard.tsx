"use client";

import { useEffect, useState } from "react";
import { formatUSD } from "@/lib/format";

interface CalEvent {
  id: string;
  title: string | null;
  start_time: string | null;
  spending_estimate: number;
  category: string | null;
  is_income_event: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  dining: "🍽",
  entertainment: "🎭",
  travel: "✈️",
  personal_care: "💇",
  health: "💊",
  work: "💼",
  social: "👥",
  income: "💰",
  other: "📅",
};

export function CalendarCard() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/connect")
      .then((r) => r.json())
      .then((d: ConnectionStatus) => {
        setStatus(d);
        if (d.connected) {
          return fetch("/api/calendar/sync")
            .then((r) => r.json())
            .then((r) => setEvents(r.events ?? []));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return null;
  if (!status?.connected) return null;

  const next7 = events.filter((e) => {
    if (!e.start_time) return false;
    const diff = new Date(e.start_time).getTime() - Date.now();
    return diff >= 0 && diff <= 7 * 86_400_000;
  });

  const financialEvents = next7.filter((e) => (e.spending_estimate ?? 0) > 0 || e.is_income_event);

  if (financialEvents.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-[var(--color-info)]/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-[var(--color-info)]">G</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-info)]">Calendar · This Week</p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {syncing ? "Syncing…" : "Refresh"}
        </button>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {financialEvents.slice(0, 5).map((event) => {
          const emoji = CATEGORY_EMOJI[event.category ?? "other"] ?? "📅";
          const date = event.start_time
            ? new Date(event.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
            : "—";

          return (
            <div key={event.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base">{emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">{event.title ?? "Untitled event"}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{date}</p>
                </div>
              </div>
              {event.is_income_event ? (
                <span className="font-mono text-xs font-semibold text-[var(--color-income)]">Income</span>
              ) : event.spending_estimate > 0 ? (
                <span className="font-mono text-xs font-semibold text-[var(--color-expense)]">~{formatUSD(event.spending_estimate)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

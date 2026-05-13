"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { formatUSD } from "@/lib/format";

const COLLAPSED_KEY = "steward:calendarCollapsed";

interface CalEvent {
  id: string;
  title: string | null;
  start_time: string | null;
  spending_estimate: number;
  is_income_event: boolean;
}

interface ConnectionStatus {
  connected: boolean;
}

export function CalendarCard({ initiallyConnected }: { initiallyConnected?: boolean }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(initiallyConnected === true);
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    if (initiallyConnected === false) return;

    async function load() {
      try {
        if (initiallyConnected === true) {
          const r = await fetch("/api/calendar/sync");
          const data = await r.json();
          setEvents(data.events ?? []);
        } else {
          const connRes = await fetch("/api/calendar/connect");
          const connData = await connRes.json() as ConnectionStatus;
          if (connData.connected) {
            const evRes = await fetch("/api/calendar/sync");
            const evData = await evRes.json();
            setEvents(evData.events ?? []);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initiallyConnected]);

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

  if (initiallyConnected === false) return null;

  if (loading) {
    return <div className="h-16 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] animate-pulse" />;
  }

  const financialEvents = events.filter((e) => {
    if (!e.start_time) return false;
    const diff = new Date(e.start_time).getTime() - Date.now();
    return diff >= 0 && diff <= 7 * 86_400_000 && ((e.spending_estimate ?? 0) > 0 || e.is_income_event);
  });

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">This Week</p>
          <ChevronDown
            size={14}
            className={`ml-1 text-[var(--text-muted)] transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors ml-3 disabled:opacity-40"
          aria-label="Refresh calendar"
        >
          <RotateCcw size={13} className={syncing ? "animate-spin" : ""} />
        </button>
      </div>

      {!collapsed && (
        <div>
          {financialEvents.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-[var(--text-muted)] italic">No financial events this week.</p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {financialEvents.slice(0, 5).map((event) => {
                const date = event.start_time
                  ? new Date(event.start_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  : "—";

                return (
                  <div key={event.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{event.title ?? "Untitled event"}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{date}</p>
                    </div>
                    {event.is_income_event ? (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
                        Income
                      </span>
                    ) : event.spending_estimate > 0 ? (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">
                        {formatUSD(event.spending_estimate)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

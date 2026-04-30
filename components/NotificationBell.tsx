"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Alert = {
  id: string;
  message: string;
  severity: "info" | "warning" | "danger";
  type: string;
  created_at: string;
  is_read: boolean;
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const [authed, setAuthed] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const fetchAlerts = useCallback(async (supabase: ReturnType<typeof createClient>) => {
    const { data } = await supabase
      .from("alerts")
      .select("id, message, severity, type, created_at, is_read")
      .order("created_at", { ascending: false })
      .limit(20);
    setAlerts((data ?? []) as Alert[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthed(true);
        fetchAlerts(supabase);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      if (session) fetchAlerts(supabase);
    });
    return () => subscription.unsubscribe();
  }, [fetchAlerts]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isAuthPage = pathname === "/login" || pathname.startsWith("/onboarding");
  if (!authed || isAuthPage) return null;

  const unread = alerts.filter((a) => !a.is_read);
  const hasUnread = unread.length > 0;

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  }

  async function markAllRead() {
    const ids = unread.map((a) => a.id);
    if (ids.length === 0) return;
    const supabase = createClient();
    await supabase.from("alerts").update({ is_read: true }).in("id", ids);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  }

  function dotColor(severity: string) {
    if (severity === "danger") return "bg-red-500";
    if (severity === "warning") return "bg-amber-500";
    return "bg-blue-400";
  }

  function textColor(severity: string) {
    if (severity === "danger") return "text-red-300";
    if (severity === "warning") return "text-amber-300";
    return "text-[var(--text-2)]";
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          open ? "bg-[var(--bg-elevated)] text-[var(--text-1)]" : "text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-2)]"
        }`}
        aria-label="Notifications"
      >
        <BellIcon />
        {hasUnread && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg-card)]" />
        )}
      </button>

      {open && (
        <div
          className={`absolute top-10 z-[60] w-80 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl shadow-black/60 ${
            align === "left" ? "left-0" : "right-0"
          }`}
          style={{ animation: "notifSlideUp 0.15s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <style>{`
            @keyframes notifSlideUp {
              from { opacity: 0; transform: translateY(6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--text-1)]">
              Notifications
              {hasUnread && (
                <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                  {unread.length}
                </span>
              )}
            </p>
            {hasUnread && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--text-3)] transition-colors hover:text-emerald-400"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                <p className="text-sm font-medium text-emerald-400">You&apos;re all caught up ✓</p>
                <p className="text-xs text-[var(--text-3)]">No notifications right now</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--divider)]">
                {alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => markRead(alert.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)] ${
                      alert.is_read ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor(alert.severity)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${textColor(alert.severity)}`}>
                          {alert.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-3)]">{timeAgo(alert.created_at)}</p>
                      </div>
                      {!alert.is_read && (
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

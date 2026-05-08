"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ComingItem {
  id: string;
  type: "bill" | "event" | "income" | "goal";
  title: string;
  date: string; // YYYY-MM-DD or ISO
  amount?: number;
}

function daysLabel(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `in ${diff}d`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const TYPE_COLORS: Record<ComingItem["type"], { bg: string; text: string; icon: string }> = {
  income: { bg: "bg-emerald-900/30 border-emerald-800/40", text: "text-emerald-400", icon: "💵" },
  bill:   { bg: "bg-red-900/20 border-red-800/30",        text: "text-red-400",     icon: "📄" },
  event:  { bg: "bg-purple-900/20 border-purple-800/30",  text: "text-purple-400",  icon: "📅" },
  goal:   { bg: "bg-amber-900/20 border-amber-800/30",    text: "text-amber-400",   icon: "🎯" },
};

const GOOGLE_CLIENT_ID_SET = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export function ComingUpWidget() {
  const router = useRouter();
  const [items, setItems] = useState<ComingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [calConnecting, setCalConnecting] = useState(false);
  const [calJustConnected, setCalJustConnected] = useState(false);
  const [calOAuthError, setCalOAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const today = new Date().toISOString().split("T")[0];
      const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().split("T")[0];

      const [billsRes, incomeRes, goalsRes, calRes, eventsRes] = await Promise.all([
        supabase.from("bills").select("id, name, amount, next_due_date").eq("user_id", user.id).gte("next_due_date", today).lte("next_due_date", in14).order("next_due_date", { ascending: true }).limit(5),
        supabase.from("income_sources").select("id, name, amount, next_expected_date").eq("user_id", user.id).eq("is_active", true).gte("next_expected_date", today).lte("next_expected_date", in14).order("next_expected_date", { ascending: true }).limit(3),
        supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", user.id).gte("deadline", today).lte("deadline", in14).limit(3),
        supabase.from("calendar_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("calendar_events_cache").select("id, title, start_time, spending_estimate, is_income_event").eq("user_id", user.id).gte("start_time", new Date().toISOString()).lte("start_time", new Date(Date.now() + 14 * 86_400_000).toISOString()).order("start_time", { ascending: true }).limit(5),
      ]);

      setCalendarConnected(!!calRes.data);

      // Preload Google Identity Services if calendar not connected
      if (!calRes.data && GOOGLE_CLIENT_ID_SET) {
        if (window.google?.accounts) {
          setGsiLoaded(true);
        } else {
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.onload = () => setGsiLoaded(true);
          document.head.appendChild(script);
        }
      }

      const combined: ComingItem[] = [];

      for (const b of billsRes.data ?? []) {
        combined.push({ id: `bill-${b.id}`, type: "bill", title: b.name, date: b.next_due_date, amount: Number(b.amount) });
      }
      for (const i of incomeRes.data ?? []) {
        combined.push({ id: `income-${i.id}`, type: "income", title: i.name, date: i.next_expected_date, amount: Number(i.amount) });
      }
      for (const g of goalsRes.data ?? []) {
        if (!g.deadline) continue;
        combined.push({ id: `goal-${g.id}`, type: "goal", title: g.name, date: g.deadline, amount: Number(g.target_amount) - Number(g.current_amount) });
      }
      for (const e of eventsRes.data ?? []) {
        if (!e.title) continue;
        combined.push({ id: `event-${e.id}`, type: e.is_income_event ? "income" : "event", title: e.title, date: e.start_time, amount: e.spending_estimate > 0 ? Number(e.spending_estimate) : undefined });
      }

      // Sort chronologically
      combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(combined);
      setLoading(false);
    }
    load();
  }, []);

  function handleCalendarConnect() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
    if (!clientId || !gsiLoaded || !window.google) return;
    setCalConnecting(true);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setCalConnecting(false);
          setCalOAuthError(resp.error === "access_denied" ? "Access denied — try again." : `Google error: ${resp.error ?? "no token returned"}. Check the /api/calendar/diagnostic page.`);
          return;
        }
        await fetch("/api/calendar/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: resp.access_token }),
        });
        await fetch("/api/calendar/sync", { method: "POST" });
        setCalJustConnected(true);
        setCalendarConnected(true);
        setCalConnecting(false);
        router.refresh();
      },
    });
    client.requestAccessToken();
  }

  if (loading) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Coming up · next 14 days</h2>
        <a href="/transactions" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">See all →</a>
      </div>

      {calJustConnected ? (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4 text-center">
          <p className="text-sm text-emerald-400">Calendar connected! Events will appear here shortly.</p>
        </div>
      ) : items.length === 0 && calendarConnected === false && GOOGLE_CLIENT_ID_SET ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm text-[var(--text-3)]">Connect your calendar to see what&apos;s coming</p>
          <button
            type="button"
            onClick={handleCalendarConnect}
            disabled={calConnecting || !gsiLoaded}
            className="mt-2 inline-block text-xs text-[var(--accent)] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {calConnecting ? "Connecting…" : "Connect Google Calendar →"}
          </button>
          {calOAuthError && (
            <p className="mt-1 text-[10px] text-red-400">{calOAuthError}</p>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm text-[var(--text-3)]">Clear skies for the next two weeks.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {items.map((item) => {
            const { bg, text, icon } = TYPE_COLORS[item.type];
            return (
              <div
                key={item.id}
                className={`flex-shrink-0 rounded-xl border ${bg} p-3 min-w-[130px] max-w-[160px]`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{icon}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${text}`}>
                    {daysLabel(item.date)}
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--text-1)] leading-tight truncate">{item.title}</p>
                {item.amount != null && item.amount > 0 && (
                  <p className={`mt-1 text-sm font-semibold ${text}`}>{fmt(item.amount)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

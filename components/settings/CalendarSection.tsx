"use client";

import { useEffect, useState } from "react";

interface ConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
}

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

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function CalendarSection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/connect")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false));

    if (typeof window !== "undefined") {
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
  }, []);

  function handleConnect() {
    if (!CLIENT_ID || !gsiLoaded || !window.google) return;
    setConnecting(true);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setConnecting(false);
          return;
        }
        await fetch("/api/calendar/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: resp.access_token }),
        });
        // Trigger initial sync
        await fetch("/api/calendar/sync", { method: "POST" });
        setStatus({ connected: true, connectedAt: new Date().toISOString() });
        setConnecting(false);
      },
    });

    client.requestAccessToken();
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/calendar/connect", { method: "DELETE" });
    setStatus({ connected: false, connectedAt: null });
    setDisconnecting(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Google Calendar</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Let Steward see your upcoming events and estimate their financial impact.
        </p>
      </div>

      {loading ? (
        <div className="h-10 rounded-xl shimmer" />
      ) : status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-[var(--color-income)] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-primary)]">Calendar connected</p>
              {status.connectedAt && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Since {new Date(status.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full rounded-xl border border-[var(--color-danger)]/20 py-2.5 text-sm text-[var(--color-expense)] transition-all hover:border-[var(--color-danger)]/40 disabled:opacity-40"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect calendar"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {!CLIENT_ID ? (
            <p className="text-xs text-[var(--text-muted)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-3">
              Calendar integration requires <code className="text-[var(--text-secondary)]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to be configured.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !gsiLoaded}
              className="w-full rounded-xl border border-[var(--border-default)] py-2.5 text-sm text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" fill="#FFC107"/>
                <path d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                <path d="M24 44c5.5 0 10.4-2.1 14.1-5.4l-6.5-5.5C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 40.1 16.3 44 24 44z" fill="#4CAF50"/>
                <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.5 5.5C37.3 38.9 44 33.9 44 24c0-1.3-.1-2.7-.4-3.5z" fill="#1976D2"/>
              </svg>
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </button>
          )}
          <p className="text-[11px] text-[var(--text-muted)] text-center">
            Read-only access. Steward never modifies your calendar.
          </p>
        </div>
      )}
    </div>
  );
}

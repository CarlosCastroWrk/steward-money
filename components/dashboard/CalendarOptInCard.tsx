"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DISMISS_KEY = "calendar_optin_dismissed_until";

export function CalendarOptInCard({ initiallyConnected }: { initiallyConnected?: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  useEffect(() => {
    if (!clientId) return;
    if (initiallyConnected === true) return; // server says already connected — skip

    // Don't show if user dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    if (initiallyConnected === false) {
      // Server confirmed not connected — show immediately, no API call needed
      setVisible(true);
    } else {
      // Fallback: check via API
      fetch("/api/calendar/connect")
        .then((r) => r.json())
        .then((d) => { if (!d.connected) setVisible(true); })
        .catch(() => {});
    }

    // Load Google Identity Services
    if (window.google?.accounts) {
      setGsiLoaded(true);
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => setGsiLoaded(true);
      document.head.appendChild(script);
    }
  }, [clientId, initiallyConnected]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 86_400_000));
    setVisible(false);
  }

  function handleConnect() {
    if (!clientId || !gsiLoaded || !window.google) return;
    setConnecting(true);

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      callback: async (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          setConnecting(false);
          setOauthError(resp.error === "access_denied" ? "Access denied." : `Google error: ${resp.error ?? "no token"}. Visit /api/calendar/diagnostic for setup instructions.`);
          return;
        }
        await fetch("/api/calendar/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: resp.access_token }),
        });
        await fetch("/api/calendar/sync", { method: "POST" });
        setConnected(true);
        setShowConfirm(true);
        setConnecting(false);
        router.refresh();
        setTimeout(() => setShowConfirm(false), 4000);
      },
    });

    client.requestAccessToken();
  }

  if (!visible) return null;

  if (showConfirm || connected) {
    return (
      <div className="rounded-2xl border border-[var(--color-income)]/20 bg-[var(--color-income)]/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-1)]">Calendar connected</p>
            <p className="text-xs text-[var(--text-2)]">I&apos;ll factor in your events going forward.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-2)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-1)]">Sync your calendar?</p>
          <p className="mt-1 text-xs text-[var(--text-2)] leading-relaxed">
            Steward works better when it knows what&apos;s coming. Connect Google Calendar so I can align your money with your real life — appointments, trips, big events.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !gsiLoaded}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" fill="white"/>
              </svg>
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            >
              Maybe later
            </button>
          </div>
          {oauthError && (
            <p className="mt-2 text-[11px] text-red-400">{oauthError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";

// Mounts only after token is ready; auto-opens Plaid Link UI
function PlaidLinkOpener({ token, onDone }: { token: string; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name ?? null,
            institution_id: metadata.institution?.institution_id ?? null,
          }),
        });
        onDone();
        router.refresh();
      } catch {
        setError("Connection failed — try again");
      }
    },
    [router, onDone]
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });
  useEffect(() => { if (ready) open(); }, [ready, open]);

  return error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null;
}

export function ConnectBankCard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const text = await r.text();
      let d: { link_token?: string; error?: string } = {};
      try { d = JSON.parse(text); } catch { /* non-JSON */ }
      if (d.link_token) setToken(d.link_token);
      else setError(d.error ?? `Could not initialize connection (${r.status})`);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-6">
        <p className="text-lg font-bold text-emerald-300">Bank connected!</p>
        <p className="mt-1 text-sm text-emerald-300/60">Your accounts and transactions are syncing...</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[var(--accent)]/8 blur-2xl" />
      <div className="relative">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/15">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-1)]">Connect your bank</h2>
        <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed max-w-sm">
          See your real balance, track transactions automatically, and let Steward calculate exactly what you can safely spend.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40 active:scale-[0.98]"
          >
            {loading ? "Loading…" : "Connect my bank"}
          </button>
          <a
            href="/accounts"
            className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
          >
            Manage accounts →
          </a>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {token && <PlaidLinkOpener token={token} onDone={() => setConnected(true)} />}
        <p className="mt-4 text-[10px] text-[var(--text-dim)]">
          Bank-level encryption via Plaid. We never store your credentials.
        </p>
      </div>
    </div>
  );
}

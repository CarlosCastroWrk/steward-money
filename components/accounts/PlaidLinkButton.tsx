"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";

// Inner: only rendered once a real token exists — usePlaidLink never sees "" or null.
function PlaidLinkReady({ token }: { token: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ accounts: number; transactions: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setSyncing(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name ?? null,
            institution_id: metadata.institution?.institution_id ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");
        setResult({ accounts: data.accounts_synced, transactions: data.transactions_synced });
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setSyncing(false);
      }
    },
    [router]
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  if (result) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
        Connected — {result.accounts} account{result.accounts !== 1 ? "s" : ""} and {result.transactions} transactions imported.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready || syncing}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
      >
        {syncing ? "Syncing…" : ready ? "Connect bank" : "Preparing…"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// Outer: fetches the link token, then hands off to PlaidLinkReady.
export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (d.link_token) setLinkToken(d.link_token);
        else setError(d.error ?? `Failed to initialize bank connection (${r.status})`);
      })
      .catch(() => setError("Network error — check your connection."));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" disabled className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black opacity-40">
          Connect bank
        </button>
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (!linkToken) {
    return (
      <button type="button" disabled className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black opacity-40">
        Loading…
      </button>
    );
  }

  return <PlaidLinkReady token={linkToken} />;
}

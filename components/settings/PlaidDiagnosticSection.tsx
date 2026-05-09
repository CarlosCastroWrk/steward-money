"use client";

import { useState } from "react";

type DiagResult = {
  plaid_env: string;
  is_sandbox: boolean;
  connected_items: number;
  institutions: string[];
  connected_accounts: number;
  accounts: { name: string; type: string }[];
  last_synced: string | null;
  transactions_last_30d: number;
};

type SyncResult = { accounts_updated: number; transactions_synced: number };

export function PlaidDiagnosticSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  async function runDiagnostic() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plaid/diagnostic");
      if (res.ok) setResult(await res.json());
      else setError("Failed to run diagnostic");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function runDeepSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deep: true }),
      });
      if (res.ok) setSyncResult(await res.json());
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-1)]">Plaid Sync Diagnostic</h3>
        <p className="mt-1 text-xs text-[var(--text-3)]">Check your bank connection and transaction sync health.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-1)] disabled:opacity-40"
        >
          {loading ? "Checking…" : "Run Diagnostic"}
        </button>
        <button
          onClick={runDeepSync}
          disabled={syncing}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-2)] transition hover:border-blue-700/40 hover:text-blue-400 disabled:opacity-40"
        >
          {syncing ? "Syncing…" : "Deep Sync (90d)"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {result && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${result.is_sandbox ? "bg-amber-400" : "bg-green-400"}`} />
            <span className="text-sm font-semibold text-[var(--text-1)]">
              Plaid {result.is_sandbox ? "Sandbox" : "Production"}
            </span>
          </div>

          {result.is_sandbox && (
            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-700/30 rounded-xl px-3 py-2">
              Running in sandbox mode — you&apos;ll see test data only. Real transactions require Plaid production approval.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[var(--text-3)]">Banks Connected</p>
              <p className="mt-1 text-base font-semibold text-[var(--text-1)]">{result.connected_items}</p>
              {result.institutions.length > 0 && (
                <p className="mt-0.5 text-[var(--text-3)] truncate">{result.institutions.join(", ")}</p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[var(--text-3)]">Accounts</p>
              <p className="mt-1 text-base font-semibold text-[var(--text-1)]">{result.connected_accounts}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[var(--text-3)]">Transactions (30d)</p>
              <p className="mt-1 text-base font-semibold text-[var(--text-1)]">{result.transactions_last_30d}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <p className="text-[var(--text-3)]">Last Synced</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-1)]">
                {result.last_synced
                  ? new Date(result.last_synced).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Never"}
              </p>
            </div>
          </div>

          {result.accounts.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Linked accounts</p>
              {result.accounts.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1">
                  <span className="text-xs text-[var(--text-2)]">{a.name}</span>
                  <span className="text-[10px] text-[var(--text-3)] capitalize">{a.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {syncResult && (
        <div className="rounded-xl border border-green-700/30 bg-green-900/10 px-4 py-3 text-sm text-green-400">
          Deep sync complete — {syncResult.accounts_updated} accounts updated, {syncResult.transactions_synced} transactions processed
        </div>
      )}
    </div>
  );
}

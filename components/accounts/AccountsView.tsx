"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "./AccountCard";
import { AddAccountModal } from "./AddAccountModal";
import { PlaidLinkButton } from "./PlaidLinkButton";
import type { Account, PlaidItem } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ accounts_updated: number; transactions_synced: number } | null>(null);

  const sync = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        router.refresh();
        window.setTimeout(() => setResult(null), 4000);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:border-emerald-700 hover:text-emerald-400 disabled:opacity-40"
      >
        {busy ? "Syncing…" : "Sync balances"}
      </button>
      {result && (
        <span className="text-xs text-emerald-400">
          {result.accounts_updated} accounts · {result.transactions_synced} new txns
        </span>
      )}
    </div>
  );
}

function DisconnectButton({ item }: { item: PlaidItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    const name = item.institution_name ?? "this bank";
    if (!window.confirm(`Disconnect ${name}? All linked accounts and transactions will be removed.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.item_id }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={disconnect}
      disabled={busy}
      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-40"
    >
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

type Props = {
  accounts: Account[];
  plaidItems: PlaidItem[];
  totalCash: number;
  totalDebt: number;
  net: number;
};

export function AccountsView({ accounts, plaidItems, totalCash, totalDebt, net }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-[var(--text-1)]">Accounts</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">Your connected and manual accounts</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plaidItems.length > 0 && <SyncButton />}
            <PlaidLinkButton />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-2)]"
            >
              Add manual
            </button>
          </div>
        </div>

        {/* Connected banks */}
        {plaidItems.length > 0 && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Connected banks</p>
            <div className="flex flex-col gap-2">
              {plaidItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text-2)]">{item.institution_name ?? "Unknown institution"}</span>
                  <DisconnectButton item={item} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Total cash</p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-1)]">{formatCurrency(totalCash)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Total debt</p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-1)]">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Net</p>
            <p className={`mt-2 text-xl font-semibold ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(net)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      </div>

      <AddAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}

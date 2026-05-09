"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAutoSync } from "@/hooks/useAutoSync";
import { AccountCard } from "./AccountCard";
import { AddAccountModal } from "./AddAccountModal";
import { PlaidLinkButton } from "./PlaidLinkButton";
import type { Account, PlaidItem } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function isDepository(a: Account) {
  return a.plaid_type ? a.plaid_type === "depository" : ["checking", "savings"].includes(a.type);
}
function isCredit(a: Account) {
  return a.plaid_type ? a.plaid_type === "credit" : a.type === "credit card";
}
function isLoan(a: Account) {
  return a.plaid_type ? a.plaid_type === "loan" : a.type === "debt / installment";
}
function isInvestment(a: Account) {
  return a.plaid_type === "investment" || a.type === "trading";
}

function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    accounts_updated: number;
    item_errors?: { institution: string; code: string }[];
  } | null>(null);

  const sync = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        router.refresh();
        window.setTimeout(() => setResult(null), 5000);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:border-emerald-700 hover:text-emerald-400 disabled:opacity-40"
      >
        {busy ? "Syncing…" : "Sync balances"}
      </button>
      {result && (
        <span className="text-xs text-emerald-400">{result.accounts_updated} accounts updated</span>
      )}
      {result?.item_errors?.map((e) => (
        <span key={e.institution} className="text-xs text-amber-400">
          {e.institution}: {e.code}
        </span>
      ))}
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
      await fetch("/api/plaid/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.item_id }),
      });
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

function AccountSection({ title, accounts }: { title: string; accounts: Account[] }) {
  if (accounts.length === 0) return null;
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">{title}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => <AccountCard key={a.id} account={a} />)}
      </div>
    </div>
  );
}

type Props = {
  accounts: Account[];
  plaidItems: PlaidItem[];
  totalCash: number;
  totalDebt: number;
  net: number;
  serverLastSynced?: string | null;
};

export function AccountsView({ accounts, plaidItems, totalCash, totalDebt, net, serverLastSynced = null }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  useAutoSync({
    serverLastSynced,
    enabled: plaidItems.length > 0,
    onSyncComplete: () => router.refresh(),
  });

  const cash        = accounts.filter(isDepository);
  const creditCards = accounts.filter(isCredit);
  const loans       = accounts.filter(isLoan);
  const investments = accounts.filter(isInvestment);
  const other       = accounts.filter(
    (a) => !isDepository(a) && !isCredit(a) && !isLoan(a) && !isInvestment(a)
  );

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-[var(--text-1)]">Accounts</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">Your connected and manual accounts</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
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

        {plaidItems.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
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

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Total cash</p>
            <p className="mt-2 text-xl font-semibold text-emerald-400">{formatCurrency(totalCash)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-3)]">Checking &amp; savings</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Total owed</p>
            <p className="mt-2 text-xl font-semibold text-red-400">{formatCurrency(totalDebt)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-3)]">Cards &amp; loans</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Net worth</p>
            <p className={`mt-2 text-xl font-semibold ${net >= 0 ? "text-[var(--text-1)]" : "text-red-400"}`}>
              {formatCurrency(net)}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-3)]">Cash minus debt</p>
          </div>
        </div>

        <AccountSection title="Cash Accounts" accounts={cash} />
        <AccountSection title="Credit Cards" accounts={creditCards} />
        <AccountSection title="Loans" accounts={loans} />
        <AccountSection title="Investments" accounts={investments} />
        <AccountSection title="Other" accounts={other} />

        {accounts.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
            <p className="text-sm text-[var(--text-3)]">No accounts yet. Connect your bank or add one manually.</p>
          </div>
        )}
      </div>

      <AddAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}

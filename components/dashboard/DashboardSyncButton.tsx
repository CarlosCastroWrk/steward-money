"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  lastSyncedLabel: string | null;
  syncIsStale: boolean;
}

export function DashboardSyncButton({ lastSyncedLabel, syncIsStale }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  async function handleSync(e: React.MouseEvent) {
    e.preventDefault();
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/plaid/sync", { method: "POST" });
      setJustSynced(true);
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  const label = syncing
    ? "Syncing…"
    : justSynced
    ? "Synced · Sync"
    : lastSyncedLabel
    ? `${lastSyncedLabel} · Sync`
    : "Sync now";

  if (syncIsStale) {
    return (
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-400/80 hover:text-amber-400 transition-colors disabled:opacity-60"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
        {syncing
          ? "Syncing…"
          : lastSyncedLabel
          ? `${lastSyncedLabel} — Balance may be outdated · Sync now`
          : "Balance may be outdated · Sync now"}
      </button>
    );
  }

  if (!lastSyncedLabel) return null;

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="mt-1 inline-block text-[10px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40"
    >
      {label}
    </button>
  );
}

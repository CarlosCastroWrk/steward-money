"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useAutoSync } from "@/hooks/useAutoSync";

interface Props {
  serverLastSynced: string | null;
}

function relativeTime(ts: string | null): string {
  if (!ts) return "Never synced";
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60)   return "Synced just now";
  if (secs < 3600) return `Synced ${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `Synced ${Math.floor(secs / 3600)}h ago`;
  return `Synced ${Math.floor(secs / 86400)}d ago`;
}

export function DashboardSyncButton({ serverLastSynced }: Props) {
  const router = useRouter();
  const toast = useToast();

  const { syncing, lastSynced, syncError, syncNow } = useAutoSync({
    serverLastSynced,
    onSyncComplete: () => {
      router.refresh();
      toast("Synced — balance updated.");
    },
  });

  // Re-render the relative time every 60 seconds
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const isStale = lastSynced
    ? Date.now() - new Date(lastSynced).getTime() > 2 * 60 * 60 * 1000 // amber after 2h
    : true;

  async function handleTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await syncNow();
  }

  if (syncing) {
    return (
      <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-white/40">
        <span className="h-1.5 w-1.5 animate-spin rounded-full border border-white/30 border-t-white/70" />
        Syncing…
      </div>
    );
  }

  if (syncError) {
    return (
      <button
        type="button"
        onClick={handleTap}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
        Sync failed — tap to retry
      </button>
    );
  }

  if (isStale) {
    return (
      <button
        type="button"
        onClick={handleTap}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-400/80 hover:text-amber-400 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
        {lastSynced
          ? `${relativeTime(lastSynced)} — may be outdated · Sync now`
          : "Balance may be outdated · Sync now"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="mt-1 inline-block text-[10px] text-white/30 hover:text-white/50 transition-colors"
    >
      {relativeTime(lastSynced)} · Sync
    </button>
  );
}

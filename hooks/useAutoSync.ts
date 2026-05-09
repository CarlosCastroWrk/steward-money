"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const SYNC_LS_KEY = "steward:lastSynced";
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

interface UseAutoSyncOptions {
  serverLastSynced: string | null;
  onSyncComplete?: () => void;
  enabled?: boolean;
}

interface UseAutoSyncReturn {
  syncing: boolean;
  lastSynced: string | null;
  syncError: string | null;
  syncNow: () => Promise<void>;
}

export function useAutoSync({ serverLastSynced, onSyncComplete, enabled = true }: UseAutoSyncOptions): UseAutoSyncReturn {
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(serverLastSynced);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncedRef = useRef<string | null>(serverLastSynced);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SYNC_LS_KEY);
      const resolved = stored ?? serverLastSynced;
      setLastSynced(resolved);
      lastSyncedRef.current = resolved;
    } catch {
      // localStorage unavailable (SSR or private mode)
    }
  }, [serverLastSynced]);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const now = new Date().toISOString();
      try { localStorage.setItem(SYNC_LS_KEY, now); } catch { /* ignore */ }
      lastSyncedRef.current = now;
      setLastSynced(now);
      onSyncComplete?.();
    } catch (err) {
      setSyncError((err as Error).message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [syncing, onSyncComplete]);

  function isStale(ts: string | null): boolean {
    if (!ts) return true;
    return Date.now() - new Date(ts).getTime() > COOLDOWN_MS;
  }

  // Auto-sync on mount if stale
  useEffect(() => {
    if (!enabled) return;
    if (isStale(lastSyncedRef.current)) {
      syncNow();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Auto-sync on visibility change (app resume from background)
  useEffect(() => {
    if (!enabled) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isStale(lastSyncedRef.current)) {
        syncNow();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, syncNow]);

  return { syncing, lastSynced, syncError, syncNow };
}

"use client";

import { useEffect, useRef } from "react";

const STALE_MS = 30 * 60 * 1000; // 30 minutes

export function SyncOnFocus() {
  const lastSyncedAt = useRef<number>(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSyncedAt.current < STALE_MS) return;
      lastSyncedAt.current = now;
      fetch("/api/plaid/sync", { method: "POST" }).catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return null;
}

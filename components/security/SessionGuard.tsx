"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const IDLE_MS = 30 * 60 * 1000;   // 30 min before warning
const WARN_MS = 60 * 1000;        // 60s to respond before logout

export function SessionGuard() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const resetIdle = useCallback(() => {
    if (showWarning) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);
      countTimer.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countTimer.current!);
            signOut();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, IDLE_MS);
  }, [showWarning, signOut]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (countTimer.current) clearInterval(countTimer.current);
    };
  }, [resetIdle]);

  function handleStillHere() {
    setShowWarning(false);
    if (countTimer.current) clearInterval(countTimer.current);
    resetIdle();
  }

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-modal-enter">
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border p-6 text-center"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-glow)] border border-[var(--accent-border)]">
          <span className="font-mono text-xl font-bold text-[var(--accent)]">{countdown}</span>
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Still there?</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          You&apos;ll be signed out in {countdown} second{countdown !== 1 ? "s" : ""} due to inactivity.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={signOut}
            className="flex-1 rounded-xl border border-[var(--border-default)] py-2.5 text-sm text-[var(--text-secondary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={handleStillHere}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-all duration-150 hover:bg-zinc-100 active:scale-[0.98]"
          >
            I&apos;m here
          </button>
        </div>
      </div>
    </div>
  );
}

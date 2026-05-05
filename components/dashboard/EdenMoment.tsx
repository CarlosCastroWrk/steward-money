"use client";

import { useEffect, useState } from "react";

interface EdenData {
  vision: string | null;
  displayName: string;
  moments: Array<{ id: string; content: string; moment_type: string; created_at: string }>;
}

export function EdenMoment() {
  const [data, setData] = useState<EdenData | null>(null);
  const [reflection, setReflection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reflecting, setReflecting] = useState(false);
  const [newMoment, setNewMoment] = useState("");
  const [adding, setAdding] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `eden-dismissed-${new Date().toISOString().split("T")[0]}`;

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) {
      setDismissed(true);
      setLoading(false);
      return;
    }
    fetch("/api/agents/eden")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function getReflection() {
    setReflecting(true);
    try {
      const res = await fetch("/api/agents/eden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      setReflection(d.reflection);
    } finally {
      setReflecting(false);
    }
  }

  async function addMoment() {
    if (!newMoment.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/agents/eden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ momentContent: newMoment, momentType: "gratitude" }),
      });
      const d = await res.json();
      if (d.reflection) setReflection(d.reflection);
      setNewMoment("");
      // Refresh
      const refreshed = await fetch("/api/agents/eden").then((r) => r.json());
      setData(refreshed);
    } finally {
      setAdding(false);
    }
  }

  function dismiss() {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  }

  if (loading || dismissed) return null;
  if (!data) return null;

  return (
    <div className="rounded-xl border border-pink-900/30 bg-pink-950/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-pink-500/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-pink-400">E</span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-pink-400">Eden · Vision</p>
        </div>
        <button type="button" onClick={dismiss} className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)]">Dismiss</button>
      </div>

      {data.vision && (
        <p className="text-xs text-[var(--text-3)] italic mb-3">"{data.vision}"</p>
      )}

      {reflection ? (
        <p className="text-sm text-[var(--text-2)] leading-relaxed mb-3">{reflection}</p>
      ) : (
        <button
          type="button"
          onClick={getReflection}
          disabled={reflecting}
          className="mb-3 text-xs text-pink-400 hover:text-pink-300 transition-colors"
        >
          {reflecting ? "Reflecting…" : "Get today's reflection →"}
        </button>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newMoment}
          onChange={(e) => setNewMoment(e.target.value)}
          placeholder="Record a gratitude moment…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-pink-500/40"
          onKeyDown={(e) => e.key === "Enter" && addMoment()}
        />
        <button
          type="button"
          onClick={addMoment}
          disabled={adding || !newMoment.trim()}
          className="rounded-lg bg-pink-600/80 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-pink-500/80 disabled:opacity-40"
        >
          {adding ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

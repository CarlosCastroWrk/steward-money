"use client";

import { useEffect, useState } from "react";

interface NovaMsg {
  id: string;
  message: string;
  trigger_type: string;
  created_at: string;
}

export function NovaMessage() {
  const [messages, setMessages] = useState<NovaMsg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents/nova")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function dismiss(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch("/api/agents/nova", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  if (loading || messages.length === 0) return null;

  return (
    <div className="space-y-2">
      {messages.map((msg) => (
        <div key={msg.id} className="rounded-xl border border-violet-900/30 bg-violet-950/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-5 w-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-violet-400">N</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">Nova</p>
            </div>
            <button type="button" onClick={() => dismiss(msg.id)} className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] shrink-0">×</button>
          </div>
          <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed">{msg.message}</p>
        </div>
      ))}
    </div>
  );
}

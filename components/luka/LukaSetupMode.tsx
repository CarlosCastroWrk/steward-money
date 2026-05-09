"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

export function LukaSetupMode({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (text: string, history: Message[]) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    const newHistory = [...history, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/luka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory, setup_mode: true }),
      });
      const data = await res.json();
      const reply = data.reply ?? "Sorry, something went wrong.";
      if (data.refreshNeeded) router.refresh();
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection issue. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Start the conversation automatically
  useEffect(() => {
    if (started) return;
    setStarted(true);
    setLoading(true);
    fetch("/api/luka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Let's set up my financial profile." }],
        setup_mode: true,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const reply = data.reply ?? "Hey! Let's get your finances set up. What's your name?";
        if (data.refreshNeeded) router.refresh();
        setMessages([{ role: "assistant", content: reply }]);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "Hey! Let's set up your financial profile. What's your name?" }]);
      })
      .finally(() => setLoading(false));
  }, [started, router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) send(input, messages);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--luka)]/20">
            <span className="text-xs font-bold text-[var(--luka)]">L</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-1)]">Setup with Luka</p>
            <p className="text-[10px] text-[var(--text-3)]">Your financial profile</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-[var(--border)] p-2 text-[var(--text-3)] transition hover:text-[var(--text-1)]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-4 py-5">
        {messages.length === 0 && loading && (
          <div className="flex justify-start">
            <div className="max-w-xs rounded-2xl rounded-bl-sm bg-[var(--luka-msg-bg,#2d1f4e)] px-4 py-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-emerald-700 text-white"
                  : "rounded-bl-sm bg-[var(--luka-msg-bg,#2d1f4e)] text-[var(--text-1)]"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {loading && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-xs rounded-2xl rounded-bl-sm bg-[var(--luka-msg-bg,#2d1f4e)] px-4 py-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--luka)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress hint */}
      <div className="px-4 pb-1">
        <p className="text-center text-[10px] text-[var(--text-3)]">
          Luka will save your answers as you go · Type <kbd className="font-mono">Enter</kbd> to send
        </p>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--luka)] disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => send(input, messages)}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--luka)] text-white transition hover:opacity-85 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

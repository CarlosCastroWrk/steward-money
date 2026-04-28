"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.122 2.122m8.485 8.485 2.121 2.121M5.636 18.364l2.122-2.122m8.485-8.485 2.121-2.121" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-zinc-400"
          style={{ animation: `lukaDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  );
}

export function Luka() {
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Auth gate — only show when a session exists
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  // Hide on auth/onboarding pages
  const isAuthPage = pathname === "/login" || pathname.startsWith("/onboarding");
  if (!authed || isAuthPage) return null;

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const next = [...messages, userMsg].slice(-10);
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/luka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.refreshNeeded) router.refresh();
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <>
      <style>{`
        @keyframes lukaDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes lukaSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .luka-panel { animation: lukaSlideUp 0.18s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[51] flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-900/40 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Open Luka"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="luka-panel fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-4 z-[51] flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60 md:bottom-24 md:right-6 md:w-[380px]">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600">
              <SparkleIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100">Luka</p>
              <p className="text-xs text-zinc-500">Your financial co-pilot</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4" style={{ height: 340 }}>
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm font-medium text-zinc-300">Hi, I&apos;m Luka.</p>
                <p className="text-xs text-zinc-500">Ask me anything about your finances.</p>

                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["How much can I spend today?", "What bills are coming up?", "Add a transaction"].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-700 hover:text-emerald-400 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "rounded-br-sm bg-emerald-700 text-white" : "rounded-bl-sm bg-zinc-800 text-zinc-200"
                  }`}
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-zinc-800 px-3 py-2"><TypingDots /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 px-3 py-3">
            <div className="flex items-end gap-2 rounded-xl bg-zinc-800 px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Luka anything…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-opacity disabled:opacity-40"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

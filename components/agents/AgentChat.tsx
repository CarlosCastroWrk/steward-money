"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryAction {
  type: "save" | "delete" | "update";
  content?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
  memoryActions?: MemoryAction[];
  animate?: boolean;
}

export interface AgentChatProps {
  agent: AgentName;
  prefilledMessage?: string;
  context?: string;
  initialMessage?: string;
  initialMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  onClose: () => void;
  embedded?: boolean;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function Send() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
}

function Mic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function RefreshCw() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

// ─── Animated text (smooth reveal on new AI messages) ─────────────────────────

function AnimatedText({ text, animate, color }: { text: string; animate: boolean; color: string }) {
  const [displayed, setDisplayed] = useState(animate ? "" : text);
  const [done, setDone] = useState(!animate);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animate) { setDisplayed(text); setDone(true); return; }
    let i = 0;
    const chars = text.split("");
    const speed = Math.max(5, Math.min(18, 900 / chars.length));

    function tick() {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < chars.length) {
        frameRef.current = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    }
    frameRef.current = setTimeout(tick, speed);
    return () => { if (frameRef.current) clearTimeout(frameRef.current); };
  }, [text, animate]);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {displayed}
      {!done && (
        <span
          className="ml-0.5 inline-block w-0.5 h-[1em] align-middle animate-[blink_0.8s_step-end_infinite]"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

function SuggestionChips({ suggestions, color, onPick }: { suggestions: string[]; color: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-6">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-1)] transition-all hover:border-[var(--border-strong)] active:scale-[0.97]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Memory pill ──────────────────────────────────────────────────────────────

function MemoryPill({ action }: { action: MemoryAction }) {
  if (action.type === "save") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3 w-3 flex-shrink-0">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Remembered
      </div>
    );
  }
  if (action.type === "delete") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mt-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-3 w-3 flex-shrink-0">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        Forgotten
      </div>
    );
  }
  return null;
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: color, animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Overflow menu ────────────────────────────────────────────────────────────

function OverflowMenu({ open, onNewChat, onClose }: { open: boolean; onNewChat: () => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="absolute right-3 top-full mt-1 z-10 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onNewChat}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-[var(--text-1)] hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <Plus /> New chat
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentChat({ agent, prefilledMessage, context, initialMessage, initialMessages, onClose, embedded }: AgentChatProps) {
  const config = AGENT_REGISTRY[agent];

  const seed: Message[] = initialMessages
    ? initialMessages.map((m) => ({ role: m.role, content: m.content }))
    : initialMessage
      ? [{ role: "assistant", content: initialMessage }]
      : [];

  const [messages, setMessages] = useState<Message[]>(seed);
  const [input, setInput] = useState(prefilledMessage ?? "");
  const [loading, setLoading] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [retryText, setRetryText] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const isSerif = config.fontTreatment === "serif";

  // Auto-focus
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Scroll to bottom when keyboard appears/disappears
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onVVResize() {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    vv.addEventListener("resize", onVVResize);
    return () => vv.removeEventListener("resize", onVVResize);
  }, []);

  // Close overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    function close() { setOverflowOpen(false); }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [overflowOpen]);

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  const send = useCallback(async (text: string, isRetry = false) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;
    loadingRef.current = true;
    setRetryText(null);

    const userMsg: Message = { role: "user", content: trimmed };
    const withUser = [...messages.filter((m) => !m.failed), userMsg];
    setMessages(withUser);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      const apiMessages = withUser
        .filter((m) => !m.failed)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          messages: apiMessages.slice(-20),
          context,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { reply: string; memoryActions?: MemoryAction[] };

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "Something went wrong.",
          memoryActions: data.memoryActions,
          animate: true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I couldn't connect. Tap retry to try again.", failed: true },
      ]);
      setRetryText(trimmed);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agent, context, messages]);

  // Track which assistant message index is "first in a run" for the name label
  function isFirstAI(index: number): boolean {
    if (messages[index].role !== "assistant") return false;
    if (index === 0) return true;
    return messages[index - 1].role !== "assistant";
  }

  return (
    <div
      ref={containerRef}
      className={embedded ? "flex flex-col flex-1 min-h-0 bg-[var(--bg-base)]" : "fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]"}
      style={!embedded ? { height: "100dvh" } : undefined}
    >
      {/* ─── Header (overlay mode only) ──────────────────────────────────── */}
      {!embedded && (
        <div
          ref={headerRef}
          className="relative flex-shrink-0 flex items-center justify-between bg-[var(--bg-card)] border-b border-[var(--border)] px-3"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: config.color }}
            >
              {config.name[0]}
            </div>
            <span className="text-sm font-semibold text-[var(--text-1)]">{config.name}</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOverflowOpen((o) => !o); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
              aria-label="More"
            >
              <Dots />
            </button>
            <OverflowMenu
              open={overflowOpen}
              onNewChat={() => { setMessages([]); setOverflowOpen(false); }}
              onClose={() => setOverflowOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ─── Message area ────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 gap-8 py-16">
            <div className="flex flex-col items-center gap-4">
              <div
                className="h-14 w-14 flex items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg"
                style={{ backgroundColor: config.color, boxShadow: `0 8px 24px ${config.color}40` }}
              >
                {config.name[0]}
              </div>
              <div className="text-center">
                <h2 className={`text-xl font-semibold text-[var(--text-1)] ${isSerif ? "font-[family-name:var(--font-display)]" : ""}`}>
                  {config.greeting}
                </h2>
                <p className="mt-1.5 text-sm text-[var(--text-3)] max-w-xs">{config.subtitle}</p>
              </div>
            </div>
            <SuggestionChips suggestions={config.suggestions} color={config.color} onPick={(s) => send(s)} />
          </div>
        )}

        {/* Message thread */}
        {(messages.length > 0 || loading) && (
          <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-[var(--bg-elevated)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-1)] leading-relaxed">
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  </div>
                );
              }

              // AI message — avatar + text, no background
              const showAvatar = isFirstAI(i);

              return (
                <div key={i} className="flex items-start gap-3">
                  {/* Avatar column */}
                  <div className="flex-shrink-0 w-7 mt-0.5">
                    {showAvatar && (
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.name[0]}
                      </div>
                    )}
                  </div>
                  {/* Message text */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    {showAvatar && (
                      <p className="text-[11px] font-semibold text-[var(--text-3)] mb-1.5">{config.name}</p>
                    )}
                    <div className={`text-sm text-[var(--text-1)] leading-relaxed ${isSerif ? "font-[family-name:var(--font-display)]" : ""} ${msg.failed ? "opacity-50" : ""}`}>
                      {msg.animate ? (
                        <AnimatedText text={msg.content} animate color={config.color} />
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                    {msg.memoryActions?.map((action, ai) => (
                      <MemoryPill key={ai} action={action} />
                    ))}
                    {msg.failed && retryText && (
                      <button
                        type="button"
                        onClick={() => send(retryText, true)}
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
                      >
                        <RefreshCw /> Try again
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking state */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 mt-0.5">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: config.color }}>
                    {config.name[0]}
                  </div>
                </div>
                <div className="flex-1 pt-1.5">
                  <p className="text-[11px] font-semibold text-[var(--text-3)] mb-2">{config.name}</p>
                  <ThinkingDots color={config.color} />
                </div>
              </div>
            )}

            <div className="h-1" />
          </div>
        )}
      </div>

      {/* ─── Composer ────────────────────────────────────────────────────── */}
      <div
        ref={composerRef}
        className="flex-shrink-0 bg-[var(--bg-base)] px-4 pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative flex items-end rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] focus-within:border-[var(--border-strong)] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              className="flex-1 min-w-0 resize-none bg-transparent py-3.5 pl-4 pr-12 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none"
              style={{ minHeight: "3rem", maxHeight: "8rem", lineHeight: "1.5" }}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="absolute right-2.5 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-25"
              style={{ backgroundColor: input.trim() && !loading ? config.color : "var(--border-strong)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[var(--text-3)] opacity-50">Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}

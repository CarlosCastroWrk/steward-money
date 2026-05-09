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
  onClose: () => void;
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

export function AgentChat({ agent, prefilledMessage, context, initialMessage, onClose }: AgentChatProps) {
  const config = AGENT_REGISTRY[agent];

  const seed: Message[] = initialMessage
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

  // iOS keyboard — use visualViewport to push composer above keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onVVResize() {
      const keyboardH = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      if (composerRef.current) {
        composerRef.current.style.paddingBottom = keyboardH > 0
          ? `${keyboardH}px`
          : `max(env(safe-area-inset-bottom), 16px)`;
      }
      // Scroll to bottom
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
    vv.addEventListener("resize", onVVResize);
    vv.addEventListener("scroll", onVVResize);
    return () => {
      vv.removeEventListener("resize", onVVResize);
      vv.removeEventListener("scroll", onVVResize);
    };
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
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]"
      style={{ height: "100dvh" }}
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
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

      {/* ─── Message area ────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center min-h-full px-6 gap-6 py-12">
            <div
              className="h-16 w-16 flex items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: config.color, boxShadow: `0 0 28px ${config.color}33` }}
            >
              {config.name[0]}
            </div>
            <div className="text-center">
              <h2 className={`text-2xl text-[var(--text-1)] ${isSerif ? "font-[family-name:var(--font-display)]" : "font-semibold"}`}>
                {config.greeting}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-2)]">{config.prompt}</p>
            </div>
            <SuggestionChips
              suggestions={config.suggestions}
              color={config.color}
              onPick={(s) => send(s)}
            />
          </div>
        )}

        {/* Message thread */}
        {(messages.length > 0 || loading) && (
          <div className="px-4 py-5 space-y-1">
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                // Group gap: user message is preceded by AI → add top margin
                const prevIsAI = i > 0 && messages[i - 1].role === "assistant";
                return (
                  <div key={i} className={`flex justify-end ${prevIsAI ? "mt-5" : "mt-2"}`}>
                    <div
                      className="max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm text-white leading-relaxed"
                      style={{ backgroundColor: config.color }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // AI message
              const showLabel = isFirstAI(i);
              const prevIsUser = i > 0 && messages[i - 1].role === "user";

              return (
                <div key={i} className={`${prevIsUser ? "mt-5" : "mt-1"}`}>
                  {showLabel && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-[11px] font-semibold text-[var(--text-3)]">{config.name}</span>
                    </div>
                  )}
                  <div className={`text-sm text-[var(--text-1)] ${isSerif ? "font-[family-name:var(--font-display)]" : ""} ${msg.failed ? "text-[var(--text-3)]" : ""}`}>
                    {msg.animate ? (
                      <AnimatedText text={msg.content} animate color={config.color} />
                    ) : (
                      <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                    )}
                  </div>
                  {msg.memoryActions?.map((action, ai) => (
                    <MemoryPill key={ai} action={action} />
                  ))}
                  {msg.failed && retryText && (
                    <button
                      type="button"
                      onClick={() => send(retryText, true)}
                      className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--accent)] hover:opacity-80 transition-opacity"
                    >
                      <RefreshCw /> Retry
                    </button>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="mt-5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-[11px] font-semibold text-[var(--text-3)]">{config.name}</span>
                </div>
                <ThinkingDots color={config.color} />
              </div>
            )}

            <div className="h-2" />
          </div>
        )}
      </div>

      {/* ─── Composer ────────────────────────────────────────────────────── */}
      <div
        ref={composerRef}
        className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div className="flex items-end gap-2">
          {/* Textarea wrapper with mic icon */}
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={config.prompt}
              rows={1}
              className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-4 pr-10 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--border-strong)] transition-colors"
              style={{ minHeight: "2.5rem", maxHeight: "7.5rem", lineHeight: "1.5" }}
            />
            {/* Mic icon (decorative position, right inside textarea) */}
            <button
              type="button"
              className="absolute right-3 bottom-2.5 text-[var(--text-dim)] hover:text-[var(--text-3)] transition-colors"
              tabIndex={-1}
              aria-label="Voice input"
            >
              <Mic />
            </button>
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-30"
            style={{ backgroundColor: config.color }}
          >
            <Send />
          </button>
        </div>
      </div>
    </div>
  );
}

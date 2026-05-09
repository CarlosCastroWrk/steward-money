"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AGENT_REGISTRY, type AgentName } from "@/lib/agents/registry";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  agent: AgentName;
  prefilledMessage?: string;
  context?: string;
  onClose: () => void;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12" />
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

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ color, label, size = "sm", pulsing = false }: { color: string; label: string; size?: "sm" | "lg"; pulsing?: boolean }) {
  const dim = size === "lg" ? "h-16 w-16 text-2xl" : "h-6 w-6 text-[10px]";
  return (
    <div
      className={`${dim} flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white transition-all ${pulsing ? "scale-[0.97] ring-4" : ""}`}
      style={{
        backgroundColor: color,
        ...(pulsing ? { ringColor: color, boxShadow: `0 0 0 4px ${color}25` } : {}),
      }}
    >
      {label}
    </div>
  );
}

// ── Suggestion chips ────────────────────────────────────────────────────────

function SuggestionChips({ suggestions, color, onPick }: { suggestions: string[]; color: string; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text-1)] transition-all hover:border-[var(--border-strong)] active:scale-[0.97]"
          style={{ ["--chip-hover-color" as string]: color }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isFirst,
  color,
  avatarLabel,
}: {
  msg: Message;
  isFirst: boolean;
  color: string;
  avatarLabel: string;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar placeholder — keeps alignment even when not shown */}
      <div className="h-6 w-6 flex-shrink-0">
        {!isUser && isFirst && (
          <Avatar color={color} label={avatarLabel} size="sm" />
        )}
      </div>

      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-tr-sm text-white"
            : "rounded-tl-sm bg-[var(--bg-elevated)] text-[var(--text-1)]"
        }`}
        style={isUser ? { backgroundColor: color } : undefined}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex gap-2.5">
      <Avatar color={color} label={label} size="sm" />
      <div className="rounded-2xl rounded-tl-sm bg-[var(--bg-elevated)] px-4 py-3">
        <span className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: color, animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

// ── History drawer ──────────────────────────────────────────────────────────

interface PastMessage { role: string; content: string; created_at: string }

function HistoryDrawer({
  agentName,
  color,
  open,
  onClose,
  onNewChat,
}: {
  agentName: string;
  color: string;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
}) {
  const [past, setPast] = useState<PastMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("agent_conversations")
        .select("role, content, created_at")
        .eq("user_id", user.id)
        .eq("agent_name", agentName.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(40)
        .then(({ data }) => setPast(data ?? []));
    });
  }, [open, agentName]);

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-10 bg-black/40" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 z-20 w-72 flex flex-col bg-[var(--bg-card)] border-r border-[var(--border)] overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
          <p className="text-sm font-semibold text-[var(--text-1)]">{agentName} history</p>
          <button type="button" onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors">
            <XIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => { onNewChat(); onClose(); }}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ color }}
        >
          <PlusIcon /> New chat
        </button>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {past.length === 0 && (
            <p className="text-xs text-[var(--text-3)] text-center pt-6">No past conversations yet.</p>
          )}
          {past.map((m, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-[var(--bg-elevated)]" : ""}`}>
              <span className="text-[var(--text-3)] uppercase tracking-wide text-[9px] font-semibold">{m.role}</span>
              <p className="text-[var(--text-2)] mt-0.5 line-clamp-2">{m.content}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AgentChat({ agent, prefilledMessage, context, onClose }: Props) {
  const config = AGENT_REGISTRY[agent];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(prefilledMessage ?? "");
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;
    loadingRef.current = true;
    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setLoading(true);

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, messages: newMessages, context }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "Something went wrong." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting. Try again." }]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [agent, context, messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  // Group consecutive messages from same role for avatar display
  type GroupedMessage = Message & { isFirst: boolean };
  const grouped: GroupedMessage[] = messages.map((m, i) => ({
    ...m,
    isFirst: i === 0 || messages[i - 1].role !== m.role,
  }));

  const isSerif = config.fontTreatment === "serif";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)]">

      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between bg-[var(--bg-card)] border-b border-[var(--border)] px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
      >
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
          aria-label="History"
        >
          <MenuIcon />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: config.color }}
          >
            {config.name[0]}
          </div>
          <span className="text-sm font-semibold text-[var(--text-1)]">{config.name}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Close"
        >
          <XIcon />
        </button>
      </div>

      {/* Content area */}
      <div className="relative flex-1 overflow-hidden">

        {/* History drawer */}
        <HistoryDrawer
          agentName={config.name}
          color={config.color}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onNewChat={() => setMessages([])}
        />

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-6">
            <div>
              <div
                className="h-16 w-16 mx-auto flex items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{ backgroundColor: config.color, boxShadow: `0 0 24px ${config.color}40` }}
              >
                {config.name[0]}
              </div>
            </div>
            <div className="text-center">
              <h2
                className={`text-3xl text-[var(--text-1)] leading-tight ${isSerif ? "font-[family-name:var(--font-display)]" : "font-semibold"}`}
              >
                {config.greeting}
              </h2>
              <p className="mt-2 text-base text-[var(--text-2)]">{config.subtitle}</p>
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
          <div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-2">
            {grouped.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                isFirst={msg.isFirst}
                color={config.color}
                avatarLabel={config.name[0]}
              />
            ))}
            {loading && <TypingIndicator color={config.color} label={config.name[0]} />}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-card)] px-3 pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${config.name} anything…`}
              rows={1}
              className="w-full resize-none bg-transparent text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none"
              style={{ maxHeight: 120, minHeight: "1.25rem", lineHeight: "1.5" }}
            />
          </div>
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-30"
            style={{ backgroundColor: config.color }}
          >
            {loading ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="mt-2 text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors ml-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

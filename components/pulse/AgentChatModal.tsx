"use client";

import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";

type AgentName = "argus" | "iron" | "manna" | "nova" | "eden" | "solomon" | "silas" | "echo" | "kairos";

const AGENT_ROLES: Record<AgentName, string> = {
  argus:   "Financial Watchdog",
  iron:    "Accountability Partner",
  manna:   "Daily Provision",
  nova:    "Financial Foresight",
  eden:    "Vision & Purpose",
  solomon: "Financial Wisdom",
  silas:   "Behavioral Patterns",
  echo:    "Memory Keeper",
  kairos:  "Life Transitions",
};

const AGENT_NAMES: Record<AgentName, string> = {
  argus:   "Argus",
  iron:    "Iron",
  manna:   "Manna",
  nova:    "Nova",
  eden:    "Eden",
  solomon: "Solomon",
  silas:   "Silas",
  echo:    "Echo",
  kairos:  "Kairos",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  agent: AgentName;
  initialMessage: string;
  context?: string;
  onClose: () => void;
}

export function AgentChatModal({ agent, initialMessage, context, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: initialMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    // The initial assistant message lives in the system context, not the message history.
    // Only send user/assistant pairs after the first greeting — Anthropic requires
    // messages to start with "user" and alternate properly.
    const historyAfterGreeting = messages.slice(1);
    const apiMessages: Message[] = [...historyAfterGreeting, { role: "user", content: text }];

    const fullContext = [
      context,
      `Your opening message to the user was: "${initialMessage}"`,
    ].filter(Boolean).join("\n\n");

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          messages: apiMessages.slice(-10),
          context: fullContext,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply ?? "I'm having trouble responding right now.",
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting right now." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 bg-[var(--bg-card)]">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-elevated)] transition-colors"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <AgentAvatar agent={agent} size="md" />
        <div>
          <p className="text-sm font-semibold text-[var(--text-1)]">{AGENT_NAMES[agent]}</p>
          <p className="text-xs text-[var(--text-3)]">{AGENT_ROLES[agent]}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {msg.role === "assistant" && <AgentAvatar agent={agent} size="sm" />}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-tr-sm"
                  : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-1)] rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <AgentAvatar agent={agent} size="sm" />
            <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-3)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-3)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-3)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Ask ${AGENT_NAMES[agent]} anything…`}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] transition-colors"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:opacity-90 disabled:opacity-40 flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

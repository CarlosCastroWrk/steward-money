"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LukaVoiceMode } from "@/components/luka/LukaVoiceMode";

type Action = { tool: string; label: string; detail: string };
type Message = { role: "user" | "assistant"; content: string; actions?: Action[]; created_at?: string; db_id?: string };

// ── Icons ──────────────────────────────────────────────────────────────────

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {active
        ? <><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></>
        : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></>
      }
    </svg>
  );
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      {active
        ? <><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></>
        : <><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
      }
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--text-3)]"
          style={{ animation: `lukaDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  );
}

function ActionCard({ action }: { action: Action }) {
  const icons: Record<string, string> = {
    add_bill: "📋", add_goal: "🎯", add_transaction: "💳",
    add_income_source: "💰", mark_bill_paid: "✓", mark_income_received: "✓",
    update_settings: "⚙️", trigger_kairos: "🔄", update_account_purpose: "🏦",
    save_personal_rule: "📝", bulk_setup: "✦",
  };
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5">
      <span className="text-sm">{icons[action.tool] ?? "✓"}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text-2)]">{action.label}</p>
        {action.detail && <p className="text-[10px] text-[var(--text-3)] truncate">{action.detail}</p>}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  "What can I spend today?",
  "How am I doing this week?",
  "Teach me about Roth IRAs",
  "Review my subscriptions",
  "Strategy review",
  "Tell me about my situation",
];

function MessageList({
  messages,
  loading,
  sendMessage,
  messagesEndRef,
  voiceOutputEnabled,
}: {
  messages: Message[];
  loading: boolean;
  sendMessage: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  voiceOutputEnabled: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!voiceOutputEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      ?? voices.find((v) => v.lang.startsWith("en"))
      ?? voices[0];
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [voiceOutputEnabled]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && voiceOutputEnabled) speak(last.content);
  }, [messages, voiceOutputEnabled, speak]);

  // Build message list with date separators
  const rendered: React.ReactNode[] = [];
  let lastDateLabel = "";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.created_at) {
      const label = dateSeparatorLabel(m.created_at);
      if (label !== lastDateLabel) {
        rendered.push(
          <div key={`sep-${i}`} className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[10px] text-[var(--text-3)] shrink-0">{label}</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        );
        lastDateLabel = label;
      }
    }
    rendered.push(
      <div key={m.db_id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[85%]">
          <div
            className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user" ? "rounded-br-sm bg-emerald-700 text-white" : "rounded-bl-sm bg-[var(--luka-msg-bg)] text-[var(--text-1)]"
            }`}
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {m.content}
            {m.role === "assistant" && voiceOutputEnabled && speaking && i === messages.length - 1 && (
              <span className="ml-2 inline-flex items-center gap-1 text-purple-400 text-[10px]">
                <SpeakerIcon active={true} /> speaking
              </span>
            )}
          </div>
          {m.role === "assistant" && m.actions && m.actions.length > 0 && (
            <div className="mt-1 space-y-1">
              {m.actions.map((a, j) => <ActionCard key={j} action={a} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4" style={{ flex: 1 }}>
      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-sm font-medium text-[var(--text-1)]">Hi, I&apos;m Luka.</p>
          <p className="text-xs text-[var(--text-3)]">Your financial co-pilot. Ask me anything.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {QUICK_ACTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-3)] transition-colors hover:border-purple-700/50 hover:text-purple-400"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {rendered}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-sm bg-[var(--luka-msg-bg)] px-3 py-2">
            <TypingDots />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

// ── Voice recognition hook ─────────────────────────────────────────────────

function getSpeechRecognitionClass(): (new () => any) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

function useSpeechRecognition(onResult: (text: string) => void, onEnd: () => void) {
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionClass());
  }, []);

  const start = useCallback(() => {
    const SR = getSpeechRecognitionClass();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join("");
      onResult(transcript);
    };
    rec.onend = () => { setListening(false); onEnd(); };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [onResult, onEnd]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

// ── Main Luka component ────────────────────────────────────────────────────

function dateSeparatorLabel(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Luka() {
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lukaContext, setLukaContext] = useState<{ lifeStage?: string; mainGoal?: string; nextPaycheck?: string; rulesCount?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      if (session) loadContext(supabase);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      if (session) loadContext(supabase);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load conversation history when chat opens (once per session)
  useEffect(() => {
    if (!open || historyLoaded) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("luka_conversations")
        .select("id, role, content, actions, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(40);
      if (data && data.length > 0) {
        setMessages(data.map((row) => ({
          role: row.role as "user" | "assistant",
          content: row.content,
          actions: row.actions ?? undefined,
          created_at: row.created_at,
          db_id: row.id,
        })));
      }
      setHistoryLoaded(true);
    });
  }, [open, historyLoaded]);

  async function loadContext(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [settings, rules, income] = await Promise.all([
      supabase.from("user_settings").select("life_stage, main_goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("personal_rules").select("id").eq("user_id", user.id),
      supabase.from("income_sources").select("next_expected_date").eq("user_id", user.id).eq("is_active", true).order("next_expected_date", { ascending: true }).limit(1).maybeSingle(),
    ]);
    const nextDate = income.data?.next_expected_date
      ? new Date(income.data.next_expected_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : undefined;
    setLukaContext({
      lifeStage: settings.data?.life_stage ?? undefined,
      mainGoal: settings.data?.main_goal ?? undefined,
      nextPaycheck: nextDate,
      rulesCount: rules.data?.length ?? 0,
    });
  }

  async function saveMessageToDB(msg: Message, supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
    const { data } = await supabase.from("luka_conversations").insert({
      user_id: userId,
      role: msg.role,
      content: msg.content,
      actions: msg.actions ?? null,
    }).select("id").maybeSingle();
    return data?.id ?? null;
  }

  async function clearConversation() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("luka_conversations").delete().eq("user_id", user.id);
    setMessages([]);
    setConfirmClear(false);
    setHistoryLoaded(true);
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const now = new Date().toISOString();
    const userMsg: Message = { role: "user", content: text.trim(), created_at: now };

    // Persist user message to DB
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const id = await saveMessageToDB(userMsg, supabase, user.id);
      if (id) userMsg.db_id = id;
    }

    // Use last 20 messages (excluding db_id/created_at) as API context
    const contextMessages = [...messages, userMsg].slice(-20).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    setLoading(true);
    try {
      const res = await fetch("/api/luka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
        actions: data.actions?.length ? data.actions : undefined,
        created_at: new Date().toISOString(),
      };
      // Persist assistant message to DB
      if (user) {
        const id = await saveMessageToDB(assistantMsg, supabase, user.id);
        if (id) assistantMsg.db_id = id;
      }
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.refreshNeeded) router.refresh();
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again.", created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, [messages, router]);

  const handleVoiceResult = useCallback((text: string) => setInput(text), []);
  const handleVoiceEnd = useCallback(() => {
    setTimeout(() => {
      setInput((prev) => { if (prev.trim()) sendMessage(prev); return prev; });
    }, 200);
  }, [sendMessage]);

  const { listening, supported: micSupported, start: startListening, stop: stopListening } = useSpeechRecognition(handleVoiceResult, handleVoiceEnd);

  const isAuthPage = pathname === "/login" || pathname.startsWith("/onboarding");
  if (!authed || isAuthPage) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-expand
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  const contextParts = [
    lukaContext?.lifeStage,
    lukaContext?.mainGoal,
    lukaContext?.nextPaycheck ? `paycheck ${lukaContext.nextPaycheck}` : null,
    lukaContext?.rulesCount ? `${lukaContext.rulesCount} rule${lukaContext.rulesCount !== 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  const inputArea = (
    <div className="border-t border-[var(--border)] px-3 py-3">
      <div className="flex items-end gap-2 rounded-xl bg-[var(--luka-msg-bg)] px-3 py-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask Luka anything…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text-1)] placeholder-[var(--text-3)] outline-none"
          style={{ maxHeight: 120, minHeight: "1.5rem", lineHeight: "1.5rem", overflowY: "auto" }}
        />
        {micSupported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all ${
              listening ? "bg-red-500 text-white" : "text-[var(--text-3)] hover:text-purple-400"
            }`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            <MicIcon active={listening} />
          </button>
        )}
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white transition-opacity disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setVoiceModeOpen(true); }}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--text-3)] transition-colors hover:border-purple-700/40 hover:text-purple-400"
        >
          <VoiceIcon /> Voice mode
        </button>
        <button
          type="button"
          onClick={() => {
            if (voiceOutputEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
            setVoiceOutputEnabled((v) => !v);
          }}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
            voiceOutputEnabled
              ? "border-purple-700/60 bg-purple-900/20 text-purple-400"
              : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]"
          }`}
        >
          <SpeakerIcon active={voiceOutputEnabled} />
          {voiceOutputEnabled ? "Voice on" : "Voice off"}
        </button>
      </div>
    </div>
  );

  const header = (
    <div className="flex flex-col border-b border-[var(--border)]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600">
          <SparkleIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-1)]">Luka</p>
          <p className="text-xs text-[var(--text-3)]">Your financial co-pilot</p>
        </div>
        {listening && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Listening
          </span>
        )}
        {messages.length > 0 && !confirmClear && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors px-1"
            title="Clear conversation"
          >
            Clear
          </button>
        )}
        {confirmClear && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={clearConversation} className="text-[10px] text-red-400 hover:text-red-300">Confirm</button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-[10px] text-[var(--text-3)] hover:text-[var(--text-2)]">Cancel</button>
          </div>
        )}
        <button onClick={() => { setOpen(false); setConfirmClear(false); }} className="text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]">
          <CloseIcon />
        </button>
      </div>
      {contextParts.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-[var(--text-3)] leading-relaxed">
            Luka knows: {contextParts.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );

  const messageListEl = (
    <MessageList
      messages={messages}
      loading={loading}
      sendMessage={sendMessage}
      messagesEndRef={messagesEndRef}
      voiceOutputEnabled={voiceOutputEnabled}
    />
  );

  return (
    <>
      <style>{`
        @keyframes lukaDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes lukaSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lukaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .luka-panel { animation: lukaSlideIn 0.2s cubic-bezier(0.16,1,0.3,1) both; }
        .luka-sheet { animation: lukaFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* Voice mode overlay */}
      {voiceModeOpen && <LukaVoiceMode onClose={() => setVoiceModeOpen(false)} />}

      {/* ── MOBILE: pill handle above bottom nav ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed left-1/2 z-[51] -translate-x-1/2 flex items-center gap-2 rounded-full border px-4 py-2 text-xs backdrop-blur-md transition-colors md:hidden ${
          open
            ? "border-purple-700/50 bg-[var(--luka-bg)] text-purple-400"
            : "border-[var(--border)] bg-[var(--bg-card)]/90 text-[var(--text-3)]"
        }`}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 78px)" }}
        aria-label="Open Luka"
      >
        <SparkleIcon className="h-3.5 w-3.5" />
        <span>Ask Luka…</span>
      </button>

      {/* ── MOBILE: backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[51] bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── MOBILE: full-screen chat ── */}
      {open && (
        <div
          className="luka-sheet fixed inset-0 z-[52] flex flex-col overflow-hidden bg-[var(--luka-bg)] md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {header}
          {messageListEl}
          {inputArea}
        </div>
      )}

      {/* ── DESKTOP: floating button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[51] hidden h-12 w-12 items-center justify-center rounded-full bg-purple-600 shadow-lg shadow-purple-900/40 transition-transform hover:scale-105 active:scale-95 md:flex"
        aria-label="Open Luka"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {/* ── DESKTOP: full-height side panel ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[50] hidden bg-black/30 md:block"
            onClick={() => setOpen(false)}
          />
          <div className="luka-panel fixed top-0 right-0 z-[51] hidden h-screen w-[520px] flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--luka-bg)] shadow-2xl shadow-black/40 md:flex">
            {header}
            {messageListEl}
            {inputArea}
          </div>
        </>
      )}
    </>
  );
}

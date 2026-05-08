"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LukaVoiceMode } from "@/components/luka/LukaVoiceMode";

type Action = { tool: string; label: string; detail: string };
type Message = { role: "user" | "assistant"; content: string; actions?: Action[]; created_at?: string; db_id?: string };
type Conversation = { id: string; title: string | null; updatedAt: string };

type LukaContext = {
  displayName: string;
  lifeStage?: string;
  mainGoal?: string;
  rulesCount: number;
  nextBill: { name: string; daysUntil: number } | null;
  lastConversationDaysAgo: number | null;
  recentIncome: boolean;
  hasGoals: boolean;
  subscriptionCount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function computeGreeting(ctx: LukaContext): { greeting: string; subline: string } {
  const hour = new Date().getHours();
  const name = ctx.displayName ?? "there";
  let greeting: string;
  if (hour >= 5 && hour < 11) greeting = `Morning, ${name}`;
  else if (hour >= 11 && hour < 17) greeting = `Hey ${name}`;
  else if (hour >= 17 && hour < 21) greeting = `Evening, ${name}`;
  else greeting = `Up late, ${name}?`;

  let subline: string;
  if (ctx.recentIncome) {
    subline = "Looks like your paycheck just came in — want to walk through what's next?";
  } else if (ctx.nextBill && ctx.nextBill.daysUntil <= 3) {
    const d = ctx.nextBill.daysUntil;
    subline = `${ctx.nextBill.name} is due ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}. Want to plan for it?`;
  } else if (ctx.lastConversationDaysAgo != null && ctx.lastConversationDaysAgo >= 3) {
    subline = "Been a minute — how are things?";
  } else if (ctx.nextBill && ctx.nextBill.daysUntil <= 7) {
    subline = `${ctx.nextBill.name} is coming up. Anything on your mind?`;
  } else {
    subline = "Your financial co-pilot. What's on your mind?";
  }
  return { greeting, subline };
}

function computeChips(ctx: LukaContext): string[] {
  const chips: string[] = [];
  if (ctx.recentIncome) { chips.push("Allocate my paycheck"); chips.push("What's next on my plan?"); }
  if (ctx.nextBill && ctx.nextBill.daysUntil <= 7 && chips.length < 3) chips.push(`How am I covering ${ctx.nextBill.name}?`);
  if (ctx.subscriptionCount >= 3 && chips.length < 3) chips.push("Review my subscriptions");
  if (chips.length < 3) chips.push("How am I doing?");
  if (chips.length < 4) chips.push("What should I focus on?");
  if (chips.length < 4 && ctx.hasGoals) chips.push("Check my goal progress");
  if (chips.length < 4) chips.push("What can I spend today?");
  return chips.slice(0, 4);
}

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

function formatConvTime(isoStr: string): string {
  const d = new Date(isoStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function saveMsgToDB(
  msg: Message,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  convId: string,
): Promise<string | null> {
  const { data } = await supabase.from("luka_conversations").insert({
    user_id: userId,
    conversation_id: convId,
    role: msg.role,
    content: msg.content,
    actions: msg.actions ?? null,
  }).select("id").maybeSingle();
  return data?.id ?? null;
}

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

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" />
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      {active
        ? <><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></>
        : <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" /></>}
    </svg>
  );
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      {active
        ? <><path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></>
        : <><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}
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
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-purple-400/60"
          style={{ animation: `lukaDot 1.2s ease-in-out ${i * 0.18}s infinite` }}
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
        <p className="text-[11px] font-medium text-emerald-500">{action.label}</p>
        {action.detail && <p className="text-[10px] text-[var(--text-3)] truncate">{action.detail}</p>}
      </div>
    </div>
  );
}

function dedupeActions(actions: Action[]): Action[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    const key = `${a.tool}:${a.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Message list ───────────────────────────────────────────────────────────

function MessageList({
  messages,
  loading,
  sendMessage,
  messagesEndRef,
  voiceOutputEnabled,
  lukaContext,
}: {
  messages: Message[];
  loading: boolean;
  sendMessage: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  voiceOutputEnabled: boolean;
  lukaContext: LukaContext | null;
}) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!voiceOutputEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0; utt.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
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

  const { greeting, subline } = lukaContext
    ? computeGreeting(lukaContext)
    : { greeting: "Hey there", subline: "Your financial co-pilot. Ask me anything." };
  const chips = lukaContext
    ? computeChips(lukaContext)
    : ["How am I doing?", "What can I spend today?", "Review my subscriptions", "What should I focus on?"];

  const rendered: React.ReactNode[] = [];
  let lastDateLabel = "";
  let prevRole: string | null = null;
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
    const isGrouped = m.role === prevRole;
    prevRole = m.role;
    rendered.push(
      <div key={m.db_id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0.5" : "mt-2"}`}>
        <div className="max-w-[85%]">
          <div
            className={`px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "rounded-[18px] rounded-br-[4px] bg-purple-600 text-white"
                : "rounded-[18px] rounded-bl-[4px] bg-[var(--luka-msg-bg)] text-[var(--text-1)]"
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
              {dedupeActions(m.actions).map((a, j) => <ActionCard key={j} action={a} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto px-4 py-4" style={{ flex: 1, overscrollBehavior: "contain" }}>
      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 shadow-lg shadow-purple-900/40">
            <SparkleIcon className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-xl text-[var(--text-1)]" style={{ fontFamily: "var(--font-display, inherit)" }}>
              {greeting}
            </p>
            <p className="text-sm text-[var(--text-3)] max-w-xs leading-relaxed">{subline}</p>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {chips.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="rounded-full border border-[var(--border)] px-3.5 py-1.5 text-xs text-[var(--text-2)] transition-all hover:border-purple-600/60 hover:bg-purple-600/10 hover:text-purple-400 active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {rendered}
      {loading && (
        <div className="mt-2 flex items-end gap-2 justify-start">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 shadow-sm luka-avatar-pulse">
            <SparkleIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="rounded-[18px] rounded-bl-[4px] bg-[var(--luka-msg-bg)] px-3.5 py-2.5">
            <TypingDots />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

// ── Voice recognition hook ─────────────────────────────────────────────────

function getSpeechRecognitionClass(): (new () => unknown) | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as Record<string, unknown>).SpeechRecognition as (new () => unknown)
    ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition as (new () => unknown)
    ?? null;
}

function useSpeechRecognition(onResult: (text: string) => void, onEnd: () => void) {
  const recognitionRef = useRef<unknown>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => { setSupported(!!getSpeechRecognitionClass()); }, []);

  const start = useCallback(() => {
    const SR = getSpeechRecognitionClass();
    if (!SR) return;
    const rec = new (SR as new () => unknown & {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: unknown; onend: unknown; onerror: unknown;
      start: () => void; stop: () => void;
    })();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: unknown) => {
      const transcript = Array.from((e as { results: unknown[] }).results as { [0]: { transcript: string } }[])
        .map((r) => r[0].transcript).join("");
      onResult(transcript);
    };
    rec.onend = () => { setListening(false); onEnd(); };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [onResult, onEnd]);

  const stop = useCallback(() => {
    (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

// ── Conversation sidebar ───────────────────────────────────────────────────

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
            <SparkleIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-1)]">Luka</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          title="New conversation"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]"
        >
          <PlusIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-[var(--text-dim)]">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={`w-full px-3 py-2.5 text-left transition-colors ${
                conv.id === activeId
                  ? "bg-purple-600/10 text-[var(--text-1)]"
                  : "text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]"
              }`}
            >
              <p className="truncate text-[12px] font-medium leading-tight">
                {conv.title ?? "New conversation"}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">{formatConvTime(conv.updatedAt)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Luka component ────────────────────────────────────────────────────

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
  const [lukaContext, setLukaContext] = useState<LukaContext | null>(null);

  // Conversation history
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConvDrawer, setShowConvDrawer] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);

  // Mobile keyboard avoidance
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const [vpOffsetTop, setVpOffsetTop] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // ── Visual viewport (mobile keyboard) ─────────────────────────────────────
  useEffect(() => {
    if (!open) { setVpHeight(null); setVpOffsetTop(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => { setVpHeight(vv.height); setVpOffsetTop(vv.offsetTop ?? 0); };
    handler();
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => { vv.removeEventListener("resize", handler); vv.removeEventListener("scroll", handler); };
  }, [open]);

  // ── External open trigger ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prefill?: string }>).detail;
      setOpen(true);
      if (detail?.prefill) setInput(detail.prefill);
    };
    window.addEventListener("luka:open", handler);
    return () => window.removeEventListener("luka:open", handler);
  }, []);

  // ── Auth + context ─────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
      if (session) loadContextData(supabase);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      if (session) loadContextData(supabase);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadContextData(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const in7Days = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split("T")[0];
    const [settings, rules, upcomingBill, lastConv, recentIncomeTx, goals, subs] = await Promise.all([
      supabase.from("user_settings").select("life_stage, main_goal, display_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("personal_rules").select("id").eq("user_id", user.id),
      supabase.from("bills").select("name, next_due_date").eq("user_id", user.id).gte("next_due_date", today).lte("next_due_date", in7Days).order("next_due_date").limit(1).maybeSingle(),
      supabase.from("luka_conversations").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("transactions").select("amount").eq("user_id", user.id).gte("date", twoDaysAgo).gt("amount", 200).limit(1).maybeSingle(),
      supabase.from("goals").select("id").eq("user_id", user.id),
      supabase.from("bills").select("id").eq("user_id", user.id).eq("is_subscription", true),
    ]);
    const lastConvDate = lastConv.data?.created_at;
    const lastConvDaysAgo = lastConvDate ? Math.floor((Date.now() - new Date(lastConvDate).getTime()) / 86_400_000) : null;
    const nextBillDate = upcomingBill.data?.next_due_date;
    const nextBillDaysUntil = nextBillDate ? Math.max(0, Math.ceil((new Date(nextBillDate + "T12:00:00").getTime() - Date.now()) / 86_400_000)) : null;
    setLukaContext({
      displayName: (settings.data?.display_name ?? "there").trim(),
      lifeStage: settings.data?.life_stage ?? undefined,
      mainGoal: settings.data?.main_goal ?? undefined,
      rulesCount: rules.data?.length ?? 0,
      nextBill: nextBillDaysUntil != null ? { name: upcomingBill.data!.name, daysUntil: nextBillDaysUntil } : null,
      lastConversationDaysAgo: lastConvDaysAgo,
      recentIncome: !!recentIncomeTx.data,
      hasGoals: (goals.data?.length ?? 0) > 0,
      subscriptionCount: subs.data?.length ?? 0,
    });
  }

  // ── Conversation loading ───────────────────────────────────────────────────

  async function fetchConversationList(supabase: ReturnType<typeof createClient>, userId: string): Promise<Conversation[]> {
    const { data } = await supabase
      .from("luka_conversations")
      .select("conversation_id, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!data) return [];
    const seen = new Set<string>();
    const convs: Conversation[] = [];
    for (const row of data) {
      if (!seen.has(row.conversation_id)) {
        seen.add(row.conversation_id);
        convs.push({ id: row.conversation_id, title: row.title ?? null, updatedAt: row.created_at });
      }
    }
    return convs;
  }

  async function fetchConversationMessages(supabase: ReturnType<typeof createClient>, userId: string, convId: string) {
    const { data } = await supabase
      .from("luka_conversations")
      .select("id, role, content, actions, created_at")
      .eq("user_id", userId)
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(60);
    if (data) {
      setMessages(data.map((row) => ({
        role: row.role as "user" | "assistant",
        content: row.content,
        actions: row.actions ?? undefined,
        created_at: row.created_at,
        db_id: row.id,
      })));
      setUserMsgCount(data.filter((m) => m.role === "user").length);
    }
  }

  // Initial history load
  useEffect(() => {
    if (!open || historyLoaded) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const convs = await fetchConversationList(supabase, user.id);
      setConversations(convs);
      if (convs.length > 0) {
        const latestId = convs[0].id;
        setActiveConvId(latestId);
        await fetchConversationMessages(supabase, user.id, latestId);
      } else {
        setActiveConvId(crypto.randomUUID());
      }
      setHistoryLoaded(true);
    });
  }, [open, historyLoaded]);

  function startNewConversation() {
    setActiveConvId(crypto.randomUUID());
    setMessages([]);
    setUserMsgCount(0);
    setShowConvDrawer(false);
    setConfirmClear(false);
  }

  async function switchConversation(convId: string) {
    if (convId === activeConvId) { setShowConvDrawer(false); return; }
    setMessages([]);
    setActiveConvId(convId);
    setShowConvDrawer(false);
    setConfirmClear(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchConversationMessages(supabase, user.id, convId);
  }

  async function clearConversation() {
    if (!activeConvId) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("luka_conversations").delete().eq("user_id", user.id).eq("conversation_id", activeConvId);
    setConversations((prev) => prev.filter((c) => c.id !== activeConvId));
    startNewConversation();
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !activeConvId) return;
    const now = new Date().toISOString();
    const userMsg: Message = { role: "user", content: text.trim(), created_at: now };

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const id = await saveMsgToDB(userMsg, supabase, user.id, activeConvId);
      if (id) userMsg.db_id = id;
    }

    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);

    // Keep conversation list current
    const convNow = now;
    const convId = activeConvId;
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === convId);
      if (exists) return [{ ...exists, updatedAt: convNow }, ...prev.filter((c) => c.id !== convId)];
      return [{ id: convId, title: null, updatedAt: convNow }, ...prev];
    });

    const contextMessages = [...messages, userMsg].slice(-20).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
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
      if (user) {
        const id = await saveMsgToDB(assistantMsg, supabase, user.id, convId);
        if (id) assistantMsg.db_id = id;
      }
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.refreshNeeded) router.refresh();

      // Auto-title after the 2nd user message
      if (newCount === 2) {
        fetch("/api/luka/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: convId }),
        }).then((r) => r.json()).then(({ title }) => {
          if (title) setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title } : c));
        }).catch(() => {});
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again.", created_at: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, [messages, router, activeConvId, userMsgCount]);

  const handleVoiceResult = useCallback((text: string) => setInput(text), []);
  const handleVoiceEnd = useCallback(() => {
    setTimeout(() => { setInput((prev) => { if (prev.trim()) sendMessage(prev); return prev; }); }, 200);
  }, [sendMessage]);

  const { listening, supported: micSupported, start: startListening, stop: stopListening } = useSpeechRecognition(handleVoiceResult, handleVoiceEnd);

  const isAuthPage = pathname === "/login" || pathname.startsWith("/onboarding");
  if (!authed || isAuthPage) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  // ── Shared sub-views ───────────────────────────────────────────────────────

  const inputArea = (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--luka-bg)] px-3 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
      <div className="flex items-end gap-2 rounded-2xl bg-[var(--luka-msg-bg)] px-3.5 py-2.5">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setTimeout(scrollToBottom, 300)}
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
          className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white transition-all active:scale-95 disabled:opacity-30"
        >
          {loading ? <SpinnerIcon /> : <SendIcon />}
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
          {voiceOutputEnabled ? "Audio on" : "Audio off"}
        </button>
      </div>
    </div>
  );

  // Chat header — desktop version (no hamburger, uses sidebar instead)
  const desktopChatHeader = (
    <div className="flex-shrink-0 flex flex-col border-b border-[var(--border)] bg-[var(--luka-bg)]">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 flex-shrink-0 ${loading ? "luka-avatar-pulse" : ""}`}>
          <SparkleIcon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-1)]">Luka</p>
            <span className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] text-[var(--text-3)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {lukaContext ? "Knows your situation" : "Online"}
            </span>
          </div>
        </div>
        {listening && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> Listening
          </span>
        )}
        {messages.length > 0 && !confirmClear && (
          <button type="button" onClick={() => setConfirmClear(true)} className="text-[10px] text-[var(--text-3)] hover:text-red-400 transition-colors px-1">
            Clear
          </button>
        )}
        {confirmClear && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={clearConversation} className="text-[10px] text-red-400 hover:text-red-300">Confirm</button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-[10px] text-[var(--text-3)]">Cancel</button>
          </div>
        )}
        <button onClick={() => { setOpen(false); setConfirmClear(false); }} className="flex-shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]">
          <CloseIcon />
        </button>
      </div>
    </div>
  );

  // Mobile header — with hamburger + new chat
  const mobileChatHeader = (
    <div className="flex-shrink-0 flex flex-col border-b border-[var(--border)] bg-[var(--luka-bg)] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setShowConvDrawer(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]"
          aria-label="Conversation history"
        >
          <MenuIcon />
        </button>
        <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 flex-shrink-0 ${loading ? "luka-avatar-pulse" : ""}`}>
          <SparkleIcon className="h-4 w-4 text-white" />
        </div>
        <p className="flex-1 text-sm font-medium text-[var(--text-1)]">Luka</p>
        {listening && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
          </span>
        )}
        {messages.length > 0 && !confirmClear && (
          <button type="button" onClick={() => setConfirmClear(true)} className="text-[10px] text-[var(--text-3)] hover:text-red-400 px-1">Clear</button>
        )}
        {confirmClear && (
          <div className="flex items-center gap-1.5 mr-1">
            <button type="button" onClick={clearConversation} className="text-[10px] text-red-400">Confirm</button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-[10px] text-[var(--text-3)]">Cancel</button>
          </div>
        )}
        <button
          type="button"
          onClick={startNewConversation}
          title="New conversation"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--bg-hover)] hover:text-purple-400"
        >
          <PlusIcon />
        </button>
        <button onClick={() => { setOpen(false); setConfirmClear(false); }} className="flex-shrink-0 text-[var(--text-3)] transition-colors hover:text-[var(--text-1)] ml-1">
          <CloseIcon />
        </button>
      </div>
    </div>
  );

  const messageListEl = (
    <MessageList
      messages={messages}
      loading={loading}
      sendMessage={sendMessage}
      messagesEndRef={messagesEndRef}
      voiceOutputEnabled={voiceOutputEnabled}
      lukaContext={lukaContext}
    />
  );

  const mobilePanelStyle: React.CSSProperties = vpHeight != null
    ? { top: vpOffsetTop, height: vpHeight, left: 0, right: 0, position: "fixed" }
    : { top: 0, left: 0, right: 0, bottom: 0, position: "fixed" };

  return (
    <>
      <style>{`
        @keyframes lukaDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes lukaSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lukaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes lukaDrawerIn {
          from { opacity: 0; transform: translateX(-100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes lukaAvatarPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.5); }
          60% { box-shadow: 0 0 0 5px rgba(147, 51, 234, 0); }
        }
        .luka-panel { animation: lukaSlideIn 0.22s cubic-bezier(0.16,1,0.3,1) both; }
        .luka-sheet { animation: lukaFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both; }
        .luka-drawer { animation: lukaDrawerIn 0.22s cubic-bezier(0.16,1,0.3,1) both; }
        .luka-avatar-pulse { animation: lukaAvatarPulse 1.4s ease-out infinite; }
      `}</style>

      {voiceModeOpen && <LukaVoiceMode onClose={() => setVoiceModeOpen(false)} />}

      {/* Mobile pill trigger */}
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

      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-[51] bg-black/60 md:hidden" onClick={() => { setShowConvDrawer(false); if (!showConvDrawer) setOpen(false); }} />
      )}

      {/* Mobile full-screen chat */}
      {open && (
        <div
          className="luka-sheet z-[52] flex flex-col overflow-hidden bg-[var(--luka-bg)] md:hidden"
          style={mobilePanelStyle}
        >
          {mobileChatHeader}
          {messageListEl}
          {inputArea}

          {/* Mobile conversation drawer (slides in from left) */}
          {showConvDrawer && (
            <>
              <div
                className="absolute inset-0 z-[10] bg-black/50"
                onClick={() => setShowConvDrawer(false)}
              />
              <div className="luka-drawer absolute left-0 top-0 z-[11] h-full w-[280px] overflow-hidden border-r border-[var(--border)] bg-[var(--bg-base)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--text-1)]">Conversations</span>
                  <button type="button" onClick={() => setShowConvDrawer(false)} className="text-[var(--text-3)]"><CloseIcon /></button>
                </div>
                <div className="overflow-y-auto" style={{ height: "calc(100% - 50px)" }}>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-purple-400 hover:bg-[var(--bg-hover)]"
                  >
                    <PlusIcon /> New conversation
                  </button>
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => switchConversation(conv.id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        conv.id === activeConvId ? "bg-purple-600/10 text-[var(--text-1)]" : "text-[var(--text-2)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <p className="truncate text-[13px] font-medium">{conv.title ?? "New conversation"}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{formatConvTime(conv.updatedAt)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Desktop fab */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[51] hidden h-12 w-12 items-center justify-center rounded-full bg-purple-600 shadow-lg shadow-purple-900/40 transition-transform hover:scale-105 active:scale-95 md:flex"
        aria-label="Open Luka"
      >
        {open ? <CloseIcon /> : <SparkleIcon />}
      </button>

      {/* Desktop side panel — 720px wide: 220px sidebar + 500px chat */}
      {open && (
        <>
          <div className="fixed inset-0 z-[50] hidden bg-black/30 md:block" onClick={() => setOpen(false)} />
          <div className="luka-panel fixed top-0 right-0 z-[51] hidden h-screen w-[720px] overflow-hidden border-l border-[var(--border)] bg-[var(--luka-bg)] shadow-2xl shadow-black/40 md:flex">
            {/* Left conversation sidebar */}
            <div className="h-full w-[220px] flex-shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--bg-inset)]">
              <ConversationList
                conversations={conversations}
                activeId={activeConvId}
                onSelect={switchConversation}
                onNew={startNewConversation}
              />
            </div>
            {/* Right chat area */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {desktopChatHeader}
              {messageListEl}
              {inputArea}
            </div>
          </div>
        </>
      )}
    </>
  );
}

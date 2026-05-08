"use client";

import { useState } from "react";

type EventType = "income" | "expense" | "social" | "personal" | "needs_clarification";

interface CalendarEventDetail {
  cacheId: string;
  title: string;
  date: string;
  location?: string | null;
  description?: string | null;
  eventType?: EventType | null;
  userConfirmed?: boolean;
  spendingEstimate?: number;
  userNotes?: string | null;
}

interface Props {
  event: CalendarEventDetail;
  onClose: () => void;
  onUpdated: (cacheId: string, update: { eventType: EventType; userConfirmed: boolean; amount?: number }) => void;
}

const CATEGORIES: Array<{ type: EventType; label: string; icon: string; color: string }> = [
  { type: "income",              label: "Work / Income",    icon: "💼", color: "border-emerald-700 bg-emerald-950/40 text-emerald-400" },
  { type: "expense",             label: "I'll spend money", icon: "💸", color: "border-red-700/60 bg-red-950/30 text-red-400" },
  { type: "social",              label: "Just social",      icon: "☕", color: "border-blue-700/60 bg-blue-950/30 text-blue-400" },
  { type: "personal",            label: "Personal",         icon: "🧘", color: "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)]" },
  { type: "needs_clarification", label: "Not sure",         icon: "❓", color: "border-amber-700/60 bg-amber-950/20 text-amber-400" },
];

function formatEventDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
    (iso.includes("T") ? ` · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");
}

export function CalendarEventDetailModal({ event, onClose, onUpdated }: Props) {
  const [selectedType, setSelectedType] = useState<EventType | null>(event.eventType ?? null);
  const [amount, setAmount] = useState<string>(event.spendingEstimate ? String(event.spendingEstimate) : "");
  const [notes, setNotes] = useState(event.userNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleCategorySelect(type: EventType) {
    setSelectedType(type);
    if (type === event.eventType && event.userConfirmed) return; // no change

    setSaving(true);
    const body: Record<string, unknown> = {
      event_id: event.cacheId,
      event_type: type,
      category: type,
    };
    if ((type === "expense" || type === "income") && amount) {
      body.cost_estimate = Number(amount);
    }

    await fetch("/api/calendar/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdated(event.cacheId, {
      eventType: type,
      userConfirmed: true,
      amount: amount ? Number(amount) : undefined,
    });
  }

  async function handleAmountBlur() {
    if (!selectedType || !amount) return;
    if (selectedType !== "expense" && selectedType !== "income") return;
    setSaving(true);
    await fetch("/api/calendar/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: event.cacheId,
        event_type: selectedType,
        category: selectedType,
        cost_estimate: Number(amount),
      }),
    }).catch(() => {});
    setSaving(false);
    onUpdated(event.cacheId, { eventType: selectedType, userConfirmed: true, amount: Number(amount) });
  }

  async function handleNotesSave() {
    setNotesSaving(true);
    await fetch(`/api/calendar/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: event.cacheId, notes }),
    }).catch(() => {});
    setNotesSaving(false);
  }

  function openLuka(prefill: string) {
    window.dispatchEvent(new CustomEvent("luka:open", { detail: { prefill } }));
    onClose();
  }

  const showAmountInput = selectedType === "expense" || selectedType === "income";
  const amountLabel = selectedType === "income" ? "Estimated earning?" : "Estimated cost?";
  const amountPrefix = selectedType === "income" ? "+" : "";

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-3)] font-medium mb-0.5">Calendar event</p>
            <h2 className="text-lg font-semibold text-[var(--text-1)] leading-tight">{event.title}</h2>
            <p className="mt-1 text-xs text-[var(--text-2)]">{formatEventDate(event.date)}</p>
            {event.location && (
              <p className="mt-0.5 text-xs text-[var(--text-3)]">📍 {event.location}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 flex-shrink-0 rounded-xl p-2 text-[var(--text-3)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        {event.description && (
          <div className="px-5 pb-3">
            <p className="text-xs text-[var(--text-2)] leading-relaxed line-clamp-3">{event.description}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          {/* Categorization */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-3">What kind of event is this?</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedType === cat.type;
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => handleCategorySelect(cat.type)}
                    disabled={saving}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-60 ${
                      isSelected
                        ? cat.color + " ring-1 ring-inset ring-current/30"
                        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="leading-tight text-left text-xs">{cat.label}</span>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-auto h-3.5 w-3.5 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Amount input — shown for expense or income */}
            {showAmountInput && (
              <div className="mt-3">
                <label className="block text-xs text-[var(--text-3)] mb-1.5">{amountLabel}</label>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
                  <span className="text-sm text-[var(--text-2)]">{amountPrefix}$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={handleAmountBlur}
                    className="flex-1 bg-transparent text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
                  />
                </div>
              </div>
            )}

            {saved && (
              <p className="mt-2 text-xs text-emerald-400">Saved ✓</p>
            )}
          </div>

          {/* Talk to agents */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-3">Discuss</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => openLuka(`I have "${event.title}" coming up on ${formatEventDate(event.date)}. Help me think about it financially.`)}
                className="w-full flex items-center gap-3 rounded-xl border border-purple-800/50 bg-purple-900/10 px-4 py-3 text-sm font-medium text-purple-400 transition hover:bg-purple-900/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
                Discuss with Luka
              </button>
              <button
                type="button"
                onClick={() => openLuka(`I have "${event.title}" coming up. I'm not sure how to categorize it or prepare financially. Can you help me think through it?`)}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-medium text-[var(--text-2)] transition hover:border-[var(--border-strong)]"
              >
                <span className="text-base leading-none">🔮</span>
                Ask Kairos
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              placeholder="Anything to remember about this event…"
              rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--border-strong)] resize-none"
            />
            {notesSaving && <p className="mt-1 text-[10px] text-[var(--text-3)]">Saving…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

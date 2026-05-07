"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Home, Car, Smartphone, Zap, Heart, GraduationCap, CreditCard, Tv, Box } from "lucide-react";
import type { AccountOption } from "./types";

export type SheetMode = "recurring" | "upcoming";

export interface RecurringPrefill {
  name?: string;
  amount?: number;
  frequency?: string;
  category?: string;
}

const CATEGORIES = [
  { id: "housing",       label: "Housing",       Icon: Home },
  { id: "transport",     label: "Transport",     Icon: Car },
  { id: "phone",         label: "Phone",         Icon: Smartphone },
  { id: "utilities",     label: "Utilities",     Icon: Zap },
  { id: "health",        label: "Health",        Icon: Heart },
  { id: "education",     label: "Education",     Icon: GraduationCap },
  { id: "debt",          label: "Debt",          Icon: CreditCard },
  { id: "entertainment", label: "Entertainment", Icon: Tv },
  { id: "other",         label: "Other",         Icon: Box },
] as const;

const FREQUENCIES = [
  { id: "weekly",    label: "Weekly"    },
  { id: "biweekly",  label: "Biweekly"  },
  { id: "monthly",   label: "Monthly"   },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly",    label: "Yearly"    },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  mode: SheetMode;
  accounts: AccountOption[];
  prefill?: RecurringPrefill;
  onSuccess: () => void;
}

const inputClass =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-inset)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30";

export function AddExpenseSheet({ open, onClose, mode, accounts, prefill, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [category, setCategory] = useState("");
  const [isAutopay, setIsAutopay] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(prefill?.name ?? "");
      setAmount(prefill?.amount ? String(prefill.amount) : "");
      setFrequency(prefill?.frequency ?? "monthly");
      setCategory(prefill?.category ?? "");
      setNextDueDate("");
      setExpenseDate("");
      setIsAutopay(false);
      setNotes("");
      setError("");
    }
  }, [open, prefill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { setError("Enter a valid amount"); return; }

    setError("");
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    if (mode === "recurring") {
      const { error: err } = await supabase.from("bills").insert({
        user_id: user.id,
        name: trimmed,
        amount: amountNum,
        frequency,
        next_due_date: nextDueDate || null,
        is_autopay: isAutopay,
        category: category || null,
        notes: notes.trim() || null,
      });
      if (err) { setError(err.message); setSubmitting(false); return; }
    } else {
      const { error: err } = await supabase.from("upcoming_expenses").insert({
        user_id: user.id,
        name: trimmed,
        amount: amountNum,
        expense_date: expenseDate,
        category: category || null,
        notes: notes.trim() || null,
        is_saving: false,
        saved_amount: 0,
      });
      if (err) { setError(err.message); setSubmitting(false); return; }
    }

    setSubmitting(false);
    onClose();
    onSuccess();
    router.refresh();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-default)] bg-[var(--bg-card)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        <div className="px-5 pb-2 pt-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {mode === "recurring" ? "Add recurring expense" : "Add upcoming expense"}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {mode === "recurring"
              ? "Monthly obligations — rent, subscriptions, loans."
              : "One-time future expenses you know are coming."}
          </p>
        </div>

        <form className="px-5 pt-2 space-y-4" onSubmit={handleSubmit}>
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "recurring" ? "e.g. Rent, Netflix, Car payment" : "e.g. Concert tickets, Car registration"}
              required
              autoFocus
            />
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">$</span>
              <input
                className={`${inputClass} pl-8`}
                type="number" inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Category grid */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(category === id ? "" : id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-all ${
                    category === id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                      : "border-[var(--border-default)] bg-[var(--bg-inset)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency — recurring only */}
          {mode === "recurring" && (
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Frequency</label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFrequency(id)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${
                      frequency === id
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                        : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {mode === "recurring" ? "Next due date" : "Date"}
            </label>
            <input
              className={inputClass}
              type="date"
              value={mode === "recurring" ? nextDueDate : expenseDate}
              onChange={(e) =>
                mode === "recurring" ? setNextDueDate(e.target.value) : setExpenseDate(e.target.value)
              }
              required={mode === "upcoming"}
            />
          </div>

          {/* Autopay — recurring only */}
          {mode === "recurring" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAutopay((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${isAutopay ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isAutopay ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-sm text-[var(--text-secondary)]">Autopay</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Notes (optional)</label>
            <textarea
              className={`${inputClass} min-h-[56px] resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes..."
            />
          </div>

          {/* Account selector — recurring only */}
          {mode === "recurring" && accounts.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Account (optional)</label>
              <select className={`${inputClass} bg-[var(--bg-inset)]`}>
                <option value="">None</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="rounded-xl bg-[var(--color-danger)]/10 px-4 py-2.5 text-sm text-[var(--color-expense)]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border-default)] py-3 text-sm text-[var(--text-muted)] transition-all hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-deep)] disabled:opacity-40"
            >
              {submitting ? "Saving…" : mode === "recurring" ? "Add expense" : "Add upcoming"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

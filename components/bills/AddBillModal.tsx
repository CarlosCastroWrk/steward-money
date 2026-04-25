"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Bill, AccountOption } from "./types";

const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  bill?: Bill | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600";

export function AddBillModal({ open, onClose, accounts, bill }: Props) {
  const router = useRouter();
  const editing = !!bill;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0");
  const [frequency, setFrequency] = useState<string>("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isAutopay, setIsAutopay] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open && bill) {
      setName(bill.name);
      setAmount(String(bill.amount));
      setFrequency(bill.frequency ?? "monthly");
      setNextDueDate(bill.next_due_date ?? "");
      setAccountId(bill.account_id ?? "");
      setIsAutopay(bill.is_autopay ?? false);
      setNotes(bill.notes ?? "");
    } else if (!open) {
      setName("");
      setAmount("0");
      setFrequency("monthly");
      setNextDueDate("");
      setAccountId("");
      setIsAutopay(false);
      setNotes("");
      setSaveError(null);
    }
  }, [open, bill]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return;

    setSaveError(null);
    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      setSaveError("Not logged in.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmed,
      amount: amountNum,
      frequency,
      next_due_date: nextDueDate || null,
      account_id: accountId || null,
      is_autopay: isAutopay
    };
    if (notes.trim()) payload.notes = notes.trim();

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("bills")
        .update(payload)
        .eq("id", bill!.id)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("bills")
        .insert({ ...payload, user_id: user.id }));
    }

    setSubmitting(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    onClose();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium text-white">
          {editing ? "Edit bill" : "Add bill"}
        </h2>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="bill-name" className="text-xs text-zinc-400">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="bill-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="bill-amount" className="text-xs text-zinc-400">
              Amount <span className="text-red-400">*</span>
            </label>
            <input
              id="bill-amount"
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="bill-freq" className="text-xs text-zinc-400">
              Frequency
            </label>
            <select
              id="bill-freq"
              className={inputClass}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bill-due" className="text-xs text-zinc-400">
              Next due date
            </label>
            <input
              id="bill-due"
              type="date"
              className={inputClass}
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="bill-account" className="text-xs text-zinc-400">
              Account
            </label>
            <select
              id="bill-account"
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              id="bill-autopay"
              type="checkbox"
              checked={isAutopay}
              onChange={(e) => setIsAutopay(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-emerald-500"
            />
            <label htmlFor="bill-autopay" className="text-sm text-zinc-300">
              Autopay
            </label>
          </div>
          <div>
            <label htmlFor="bill-notes" className="text-xs text-zinc-400">
              Notes
            </label>
            <textarea
              id="bill-notes"
              className={`${inputClass} min-h-[60px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{saveError}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {editing ? "Save changes" : "Add bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

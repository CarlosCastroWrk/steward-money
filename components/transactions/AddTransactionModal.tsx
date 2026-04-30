"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "./types";
import type { Transaction, AccountOption } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  transaction?: Transaction | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)]";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function AddTransactionModal({ open, onClose, accounts, transaction }: Props) {
  const router = useRouter();
  const editing = !!transaction;

  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(todayStr());
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [accountId, setAccountId] = useState("");
  const [isNeed, setIsNeed] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open && transaction) {
      setTxType(transaction.amount < 0 ? "expense" : "income");
      setDate(transaction.date);
      setMerchant(transaction.merchant ?? "");
      setAmount(String(Math.abs(transaction.amount)));
      setCategory(transaction.category ?? CATEGORIES[0]);
      setAccountId(transaction.account_id ?? "");
      setIsNeed(transaction.is_need ?? false);
      setNotes(transaction.notes ?? "");
    } else if (!open) {
      setTxType("expense");
      setDate(todayStr());
      setMerchant("");
      setAmount("");
      setCategory(CATEGORIES[0]);
      setAccountId("");
      setIsNeed(false);
      setNotes("");
      setSaveError(null);
    }
  }, [open, transaction]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const storedAmount = txType === "expense" ? -amountNum : amountNum;
    const payload: Record<string, unknown> = {
      date,
      merchant: merchant.trim() || null,
      amount: storedAmount,
      category: category || null,
      account_id: accountId || null,
      is_need: txType === "expense" ? isNeed : null,
      is_manual: true
    };
    if (notes.trim()) payload.notes = notes.trim();

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", transaction!.id)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("transactions")
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-medium text-[var(--text-1)]">
          {editing ? "Edit transaction" : "Add transaction"}
        </h2>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {/* Type toggle */}
          <div className="flex rounded-lg border border-zinc-700 p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                  txType === t
                    ? t === "expense"
                      ? "bg-red-900/60 text-red-200"
                      : "bg-emerald-900/60 text-emerald-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="tx-date" className="text-xs text-zinc-400">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              id="tx-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="tx-merchant" className="text-xs text-zinc-400">
              {txType === "income" ? "Source" : "Merchant"}
            </label>
            <input
              id="tx-merchant"
              className={inputClass}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={txType === "income" ? "e.g. Employer, Freelance" : "e.g. Trader Joe's"}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="tx-amount" className="text-xs text-zinc-400">
              Amount <span className="text-red-400">*</span>
            </label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label htmlFor="tx-cat" className="text-xs text-zinc-400">
              Category
            </label>
            <select
              id="tx-cat"
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tx-account" className="text-xs text-zinc-400">
              Account
            </label>
            <select
              id="tx-account"
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
          {txType === "expense" && (
            <div className="flex items-center gap-2">
              <input
                id="tx-need"
                type="checkbox"
                checked={isNeed}
                onChange={(e) => setIsNeed(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              <label htmlFor="tx-need" className="text-sm text-zinc-300">
                This is a need (not a want)
              </label>
            </div>
          )}
          <div>
            <label htmlFor="tx-notes" className="text-xs text-zinc-400">
              Notes
            </label>
            <textarea
              id="tx-notes"
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
              {editing ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SUB_CATEGORIES } from "./types";
import type { Subscription, AccountOption } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  subscription?: Subscription | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)]";

export function AddSubscriptionModal({ open, onClose, accounts, subscription }: Props) {
  const router = useRouter();
  const editing = !!subscription;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [category, setCategory] = useState<string>(SUB_CATEGORIES[0]);
  const [status, setStatus] = useState<"keep" | "cancel" | "evaluating">("keep");
  const [valueScore, setValueScore] = useState("5");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open && subscription) {
      setName(subscription.name);
      setAmount(String(subscription.amount));
      setBillingDay(subscription.billing_day ? String(subscription.billing_day) : "");
      setCategory(subscription.category ?? SUB_CATEGORIES[0]);
      setStatus(subscription.status ?? "keep");
      setValueScore(String(subscription.value_score ?? 5));
      setAccountId(subscription.account_id ?? "");
    } else if (!open) {
      setName("");
      setAmount("");
      setBillingDay("");
      setCategory(SUB_CATEGORIES[0]);
      setStatus("keep");
      setValueScore("5");
      setAccountId("");
      setSaveError(null);
    }
  }, [open, subscription]);

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

    const payload = {
      name: trimmed,
      amount: amountNum,
      billing_day: billingDay ? Number(billingDay) : null,
      category: category || null,
      status,
      value_score: Number(valueScore),
      account_id: accountId || null
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("subscriptions")
        .update(payload)
        .eq("id", subscription!.id)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("subscriptions")
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
          {editing ? "Edit subscription" : "Add subscription"}
        </h2>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="sub-name" className="text-xs text-zinc-400">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="sub-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Netflix, Spotify"
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="sub-amount" className="text-xs text-zinc-400">
              Monthly amount <span className="text-red-400">*</span>
            </label>
            <input
              id="sub-amount"
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
            <label htmlFor="sub-cat" className="text-xs text-zinc-400">
              Category
            </label>
            <select
              id="sub-cat"
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {SUB_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sub-day" className="text-xs text-zinc-400">
              Billing day of month
            </label>
            <input
              id="sub-day"
              type="number"
              min="1"
              max="31"
              className={inputClass}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Status</label>
            <div className="mt-1 flex gap-2">
              {(["keep", "evaluating", "cancel"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                    status === s
                      ? s === "keep"
                        ? "border-emerald-700 bg-emerald-900/40 text-emerald-300"
                        : s === "cancel"
                        ? "border-red-700 bg-red-900/40 text-red-300"
                        : "border-amber-700 bg-amber-900/40 text-amber-300"
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="sub-value" className="text-xs text-zinc-400">
              Value score (1–10, where 10 = essential)
            </label>
            <input
              id="sub-value"
              type="number"
              min="1"
              max="10"
              className={inputClass}
              value={valueScore}
              onChange={(e) => setValueScore(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sub-account" className="text-xs text-zinc-400">
              Account
            </label>
            <select
              id="sub-account"
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
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
              {editing ? "Save changes" : "Add subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

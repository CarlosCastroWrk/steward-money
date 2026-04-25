"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPES = [
  "checking",
  "savings",
  "credit card",
  "cash",
  "Apple Cash",
  "trading",
  "debt / installment"
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600";

export function AddAccountModal({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState<string>(TYPES[0]);
  const [currentBalance, setCurrentBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setInstitution("");
      setType(TYPES[0]);
      setCurrentBalance("0");
      setNotes("");
      setSaveError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const balanceNum = Number(currentBalance);
    if (Number.isNaN(balanceNum)) return;

    setSaveError(null);
    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      setSaveError("You must be logged in to add an account.");
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      name: trimmed,
      institution: institution.trim() || null,
      type,
      current_balance: balanceNum,
      is_manual: true,
      is_active: true,
    };
    const notesValue = notes.trim();
    if (notesValue) payload.notes = notesValue;

    const { error } = await supabase.from("accounts").insert(payload);
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
        <h2 className="text-lg font-medium text-white">Add account</h2>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="acc-name" className="text-xs text-zinc-400">
              Account name <span className="text-red-400">*</span>
            </label>
            <input
              id="acc-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="acc-inst" className="text-xs text-zinc-400">
              Institution
            </label>
            <input
              id="acc-inst"
              className={inputClass}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Chase, Wells Fargo, Cash"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="acc-type" className="text-xs text-zinc-400">
              Type <span className="text-red-400">*</span>
            </label>
            <select id="acc-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)} required>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="acc-bal" className="text-xs text-zinc-400">
              Current balance
            </label>
            <input
              id="acc-bal"
              type="number"
              step="any"
              className={inputClass}
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="acc-notes" className="text-xs text-zinc-400">
              Notes
            </label>
            <textarea
              id="acc-notes"
              className={`${inputClass} min-h-[80px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
              Add account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

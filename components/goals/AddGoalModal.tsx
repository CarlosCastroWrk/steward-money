"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GOAL_TYPES } from "./types";
import type { Goal } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600";

export function AddGoalModal({ open, onClose, goal }: Props) {
  const router = useRouter();
  const editing = !!goal;

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [type, setType] = useState<string>(GOAL_TYPES[0]);
  const [priority, setPriority] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open && goal) {
      setName(goal.name);
      setTargetAmount(String(goal.target_amount));
      setCurrentAmount(String(goal.current_amount));
      setDeadline(goal.deadline ?? "");
      setType(goal.type ?? GOAL_TYPES[0]);
      setPriority(String(goal.priority ?? 5));
    } else if (!open) {
      setName("");
      setTargetAmount("");
      setCurrentAmount("0");
      setDeadline("");
      setType(GOAL_TYPES[0]);
      setPriority("5");
      setSaveError(null);
    }
  }, [open, goal]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const targetNum = Number(targetAmount);
    const currentNum = Number(currentAmount);
    if (Number.isNaN(targetNum) || targetNum <= 0) return;

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
      target_amount: targetNum,
      current_amount: currentNum,
      deadline: deadline || null,
      type,
      priority: Number(priority)
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", goal!.id)
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("goals")
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
          {editing ? "Edit goal" : "Add goal"}
        </h2>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="goal-name" className="text-xs text-zinc-400">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="goal-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Emergency Fund, New Laptop"
            />
          </div>
          <div>
            <label htmlFor="goal-type" className="text-xs text-zinc-400">
              Type
            </label>
            <select
              id="goal-type"
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {GOAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="goal-target" className="text-xs text-zinc-400">
              Target amount <span className="text-red-400">*</span>
            </label>
            <input
              id="goal-target"
              type="number"
              step="0.01"
              min="1"
              className={inputClass}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label htmlFor="goal-current" className="text-xs text-zinc-400">
              Current amount
            </label>
            <input
              id="goal-current"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="goal-deadline" className="text-xs text-zinc-400">
              Deadline
            </label>
            <input
              id="goal-deadline"
              type="date"
              className={inputClass}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="goal-priority" className="text-xs text-zinc-400">
              Priority (1 = highest, 10 = lowest)
            </label>
            <input
              id="goal-priority"
              type="number"
              min="1"
              max="10"
              className={inputClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
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
              {editing ? "Save changes" : "Add goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

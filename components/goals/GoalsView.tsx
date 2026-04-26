"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AddGoalModal } from "./AddGoalModal";
import type { Goal } from "./types";

type Props = { goals: Goal[] };

type GoalStatus = "complete" | "on-track" | "behind" | "at-risk" | "no-deadline";

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function getDaysLeft(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr + "T00:00:00");
  return Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
}

function getGoalStatus(goal: Goal): GoalStatus {
  const current = Number(goal.current_amount);
  const target = Number(goal.target_amount);
  if (current >= target) return "complete";
  if (!goal.deadline) return "no-deadline";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(goal.deadline + "T00:00:00");
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  if (daysLeft <= 0) return "at-risk";

  const created = goal.created_at ? new Date(goal.created_at) : today;
  const totalDays = Math.max(1, (deadline.getTime() - created.getTime()) / 86400000);
  const elapsedDays = Math.max(0, (today.getTime() - created.getTime()) / 86400000);

  const timeFraction = Math.min(1, elapsedDays / totalDays);
  const progressFraction = Math.min(1, current / target);

  if (progressFraction >= timeFraction * 0.85) return "on-track";
  if (progressFraction >= timeFraction * 0.6) return "behind";
  return "at-risk";
}

const statusLabel: Record<GoalStatus, string> = {
  complete: "Complete",
  "on-track": "On track",
  behind: "Behind",
  "at-risk": "At risk",
  "no-deadline": "",
};

const statusBadge: Record<GoalStatus, string> = {
  complete: "bg-emerald-900/50 text-emerald-400",
  "on-track": "bg-emerald-900/30 text-emerald-500",
  behind: "bg-amber-900/50 text-amber-400",
  "at-risk": "bg-red-900/50 text-red-400",
  "no-deadline": "",
};

const progressBarColor: Record<GoalStatus, string> = {
  complete: "bg-emerald-400",
  "on-track": "bg-emerald-500",
  behind: "bg-amber-500",
  "at-risk": "bg-red-500",
  "no-deadline": "bg-purple-500",
};

function daysLeftLabel(days: number | null): { text: string; className: string } | null {
  if (days === null) return null;
  if (days < 0) return { text: `${Math.abs(days)} days overdue`, className: "text-red-400" };
  if (days === 0) return { text: "Due today", className: "text-red-400" };
  if (days <= 7) return { text: `${days} days left`, className: "text-amber-400" };
  if (days <= 30) return { text: `${days} days left`, className: "text-yellow-500" };
  return { text: `${days} days left`, className: "text-zinc-500" };
}

export function GoalsView({ goals }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeError, setContributeError] = useState("");
  const [contributing, setContributing] = useState(false);

  async function deleteGoal(id: string) {
    if (!confirm("Delete this goal? This cannot be undone.")) return;
    setDeletingId(id);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    router.refresh();
  }

  async function submitContribution(goal: Goal) {
    const amt = Number(contributeAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setContributeError("Enter a valid amount greater than $0.");
      return;
    }
    setContributeError("");
    setContributing(true);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setContributing(false); return; }
    const newAmount = Number(goal.current_amount) + amt;
    await supabase
      .from("goals")
      .update({ current_amount: newAmount })
      .eq("id", goal.id)
      .eq("user_id", user.id);
    setContributing(false);
    setContributeId(null);
    setContributeAmount("");
    router.refresh();
  }

  const sorted = [...goals].sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const completedCount = goals.filter((g) => Number(g.current_amount) >= Number(g.target_amount)).length;

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-white">Goals</h1>
            <p className="mt-1 text-sm text-zinc-400">Financial targets and milestones</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Add goal
          </button>
        </div>

        {goals.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total target</p>
              <p className="mt-2 text-xl font-semibold text-white">{formatUSD(totalTarget)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total saved</p>
              <p className="mt-2 text-xl font-semibold text-emerald-400">{formatUSD(totalSaved)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Remaining</p>
              <p className="mt-2 text-xl font-semibold text-zinc-300">
                {formatUSD(Math.max(0, totalTarget - totalSaved))}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Completed</p>
              <p className="mt-2 text-xl font-semibold text-zinc-300">
                {completedCount} / {goals.length}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {goals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
              <p className="font-medium text-zinc-400">No goals yet</p>
              <p className="mt-1 text-sm text-zinc-600">
                Set a target — emergency fund, vacation, down payment — and track your progress.
              </p>
              <button
                type="button"
                onClick={() => { setEditing(null); setModalOpen(true); }}
                className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Add your first goal
              </button>
            </div>
          ) : (
            sorted.map((goal) => {
              const target = Number(goal.target_amount);
              const current = Number(goal.current_amount);
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
              const status = getGoalStatus(goal);
              const days = getDaysLeft(goal.deadline);
              const daysInfo = daysLeftLabel(days);
              const weeklyAmt = (() => {
                if (!goal.deadline) return null;
                const d = getDaysLeft(goal.deadline);
                if (!d || d <= 0) return null;
                const remaining = target - current;
                if (remaining <= 0) return null;
                const weeks = d / 7;
                return remaining / weeks;
              })();

              return (
                <div
                  key={goal.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-100">{goal.name}</p>
                        {statusLabel[status] && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge[status]}`}>
                            {statusLabel[status]}
                          </span>
                        )}
                        {goal.type && (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                            {goal.type}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                        <span>
                          {formatUSD(current)} of {formatUSD(target)}{" "}
                          <span className="text-zinc-500">({pct}%)</span>
                        </span>
                        {daysInfo && (
                          <span className={`text-xs ${daysInfo.className}`}>{daysInfo.text}</span>
                        )}
                      </div>

                      {weeklyAmt !== null && weeklyAmt > 0 && (
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {formatUSD(weeklyAmt)}/week needed to hit deadline
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {status !== "complete" && (
                        <button
                          type="button"
                          onClick={() => {
                            setContributeId(contributeId === goal.id ? null : goal.id);
                            setContributeAmount("");
                            setContributeError("");
                          }}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-emerald-700 hover:text-emerald-400"
                        >
                          Contribute
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditing(goal); setModalOpen(true); }}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        disabled={deletingId === goal.id}
                        className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-900 hover:text-red-400 disabled:opacity-40"
                      >
                        {deletingId === goal.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-2 rounded-full transition-all ${progressBarColor[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Inline contribute */}
                  {contributeId === goal.id && (
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Amount to add"
                          value={contributeAmount}
                          onChange={(e) => {
                            setContributeAmount(e.target.value);
                            setContributeError("");
                          }}
                          className="w-44 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={() => submitContribution(goal)}
                          disabled={contributing}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {contributing ? "Saving..." : "Add funds"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setContributeId(null); setContributeError(""); }}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                      {contributeError && (
                        <p className="mt-1.5 text-xs text-red-400">{contributeError}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddGoalModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        goal={editing}
      />
    </section>
  );
}

"use client";

import { useState } from "react";
import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { IncomeSourceInput, StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-1)] focus:border-emerald-500 focus:outline-none";
const FREQUENCIES = ["weekly", "biweekly", "twice monthly", "monthly", "variable"];

const EMPTY_DRAFT: IncomeSourceInput = {
  id: "",
  name: "",
  amount: 0,
  frequency: "biweekly",
  next_expected_date: "",
  is_recurring: true,
  is_variable: false,
  hourly_rate: null,
  weekly_hours: null,
};

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

export function Step7Income({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const [draft, setDraft] = useState<IncomeSourceInput>(EMPTY_DRAFT);

  function patch(update: Partial<IncomeSourceInput>) {
    setDraft((prev) => ({ ...prev, ...update }));
  }

  const est = draft.is_variable
    ? (draft.hourly_rate ?? 0) * (draft.weekly_hours ?? 0)
    : draft.amount;

  const canAdd =
    draft.name.trim().length > 0 &&
    draft.next_expected_date.length > 0 &&
    (draft.is_variable
      ? (draft.hourly_rate ?? 0) > 0 && (draft.weekly_hours ?? 0) > 0
      : draft.amount > 0);

  function addIncomeSource() {
    if (!canAdd) return;
    const newSource: IncomeSourceInput = {
      ...draft,
      id: crypto.randomUUID(),
      amount: draft.is_variable
        ? (draft.hourly_rate ?? 0) * (draft.weekly_hours ?? 0)
        : draft.amount,
    };
    onChange({ incomeSources: [...formData.incomeSources, newSource] });
    setDraft(EMPTY_DRAFT);
  }

  return (
    <StepWrapper
      title="Income sources"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      {/* Name */}
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Name</label>
        <input
          className={INPUT}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Main job, Freelance"
        />
      </div>

      {/* Variable toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
        <div>
          <p className="text-sm text-zinc-200">Variable income</p>
          <p className="text-xs text-zinc-500">Estimate from hourly rate × weekly hours</p>
        </div>
        <button
          type="button"
          onClick={() => patch({ is_variable: !draft.is_variable })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            draft.is_variable ? "bg-purple-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              draft.is_variable ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Amount fields */}
      {draft.is_variable ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Hourly rate ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={INPUT}
              value={draft.hourly_rate ?? ""}
              onChange={(e) => patch({ hourly_rate: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Est. weekly hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className={INPUT}
              value={draft.weekly_hours ?? ""}
              onChange={(e) => patch({ weekly_hours: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
          {est > 0 && (
            <div className="col-span-2 rounded-lg border border-purple-900/50 bg-purple-950/20 px-3 py-2 text-sm text-purple-300">
              Estimated weekly income:{" "}
              <span className="font-semibold">{formatUSD(est)}</span>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Amount per paycheck ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-zinc-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`${INPUT} pl-7`}
              value={draft.amount || ""}
              onChange={(e) => patch({ amount: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {/* Frequency + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Frequency</label>
          <select
            className={INPUT}
            value={draft.frequency}
            onChange={(e) => patch({ frequency: e.target.value })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Next expected date</label>
          <input
            type="date"
            className={INPUT}
            value={draft.next_expected_date}
            onChange={(e) => patch({ next_expected_date: e.target.value })}
          />
        </div>
      </div>

      {/* Recurring */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-400">Recurring</label>
        <input
          type="checkbox"
          checked={draft.is_recurring}
          onChange={(e) => patch({ is_recurring: e.target.checked })}
        />
      </div>

      <button
        type="button"
        onClick={addIncomeSource}
        disabled={!canAdd}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 disabled:opacity-40"
      >
        Add income source
      </button>

      <ul className="space-y-2">
        {formData.incomeSources.map((source) => (
          <li key={source.id} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <p className="text-sm">
              {source.name} — {formatUSD(source.amount)} ({source.frequency})
              {source.is_variable && (
                <span className="ml-1 text-xs text-purple-400">variable</span>
              )}
            </p>
            <button
              type="button"
              onClick={() =>
                onChange({ incomeSources: formData.incomeSources.filter((item) => item.id !== source.id) })
              }
              className="text-zinc-400 hover:text-white"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

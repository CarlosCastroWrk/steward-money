"use client";

import { useState } from "react";
import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { IncomeSourceInput, StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";
const FREQUENCIES = ["weekly", "biweekly", "twice monthly", "monthly", "variable"];

export function Step7Income({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const [draft, setDraft] = useState<IncomeSourceInput>({
    id: "",
    name: "",
    amount: 0,
    frequency: "biweekly",
    next_expected_date: "",
    is_recurring: true
  });

  const addIncomeSource = () => {
    if (!draft.name || !draft.next_expected_date || !draft.amount) return;
    onChange({
      incomeSources: [
        ...formData.incomeSources,
        {
          ...draft,
          id: crypto.randomUUID()
        }
      ]
    });
    setDraft({
      id: "",
      name: "",
      amount: 0,
      frequency: "biweekly",
      next_expected_date: "",
      is_recurring: true
    });
  };

  return (
    <StepWrapper
      title="Income sources"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Name</label>
        <input className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-zinc-400">$</span>
          <input
            type="number"
            className={`${INPUT} pl-7`}
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Frequency</label>
        <select
          className={INPUT}
          value={draft.frequency}
          onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
        >
          {FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequency}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Next expected date</label>
        <input
          type="date"
          className={INPUT}
          value={draft.next_expected_date}
          onChange={(e) => setDraft({ ...draft, next_expected_date: e.target.value })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-400">Recurring</label>
        <input
          type="checkbox"
          checked={draft.is_recurring}
          onChange={(e) => setDraft({ ...draft, is_recurring: e.target.checked })}
        />
      </div>
      <button
        type="button"
        onClick={addIncomeSource}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
      >
        Add income source
      </button>
      <ul className="space-y-2">
        {formData.incomeSources.map((source) => (
          <li key={source.id} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <p className="text-sm">
              {source.name} - ${source.amount} ({source.frequency})
            </p>
            <button
              type="button"
              onClick={() =>
                onChange({ incomeSources: formData.incomeSources.filter((item) => item.id !== source.id) })
              }
              className="text-zinc-400 hover:text-white"
            >
              X
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

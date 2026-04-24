"use client";

import { useState } from "react";
import { AccountInput, StepProps } from "@/components/onboarding/types";
import { StepWrapper } from "@/components/onboarding/StepWrapper";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";
const TYPES = ["checking", "savings", "credit card", "cash", "Apple Cash", "trading", "debt / installment"];

export function Step9Accounts({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const [draft, setDraft] = useState<AccountInput>({
    id: "",
    name: "",
    institution: "",
    type: "checking",
    current_balance: 0
  });

  const addAccount = () => {
    if (!draft.name) return;
    onChange({
      accounts: [...formData.accounts, { ...draft, id: crypto.randomUUID() }]
    });
    setDraft({ id: "", name: "", institution: "", type: "checking", current_balance: 0 });
  };

  return (
    <StepWrapper
      title="Manual accounts"
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
        <label className="mb-1 block text-sm text-zinc-400">Institution</label>
        <input
          className={INPUT}
          value={draft.institution}
          placeholder="e.g. Chase, Wells Fargo"
          onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Type</label>
        <select className={INPUT} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Current balance</label>
        <input
          type="number"
          className={INPUT}
          value={draft.current_balance}
          onChange={(e) => setDraft({ ...draft, current_balance: Number(e.target.value) })}
        />
      </div>
      <button
        type="button"
        onClick={addAccount}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
      >
        Add account
      </button>
      <ul className="space-y-2">
        {formData.accounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <p className="text-sm">
              {account.name} - {account.type} (${account.current_balance})
            </p>
            <button
              type="button"
              onClick={() => onChange({ accounts: formData.accounts.filter((item) => item.id !== account.id) })}
              className="text-zinc-400 hover:text-white"
            >
              X
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-400">
        You can connect your bank automatically in a later step. For now, enter your current balances
        manually.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

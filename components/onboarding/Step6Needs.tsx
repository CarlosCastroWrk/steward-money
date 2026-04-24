"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";

function MoneyInput({
  label,
  value,
  onValue
}: {
  label: string;
  value: number;
  onValue: (next: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-zinc-400">$</span>
        <input
          type="number"
          className={`${INPUT} pl-7`}
          value={value}
          onChange={(e) => onValue(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function Step6Needs({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  return (
    <StepWrapper
      title="Weekly needs"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <MoneyInput
        label="Groceries (per week)"
        value={formData.weekly_groceries_min}
        onValue={(value) => onChange({ weekly_groceries_min: value })}
      />
      <MoneyInput
        label="Gas (per week)"
        value={formData.weekly_gas_min}
        onValue={(value) => onChange({ weekly_gas_min: value })}
      />
      <MoneyInput
        label="Eating out / coffee (weekly cap)"
        value={formData.weekly_eating_out_cap}
        onValue={(value) => onChange({ weekly_eating_out_cap: value })}
      />
      <MoneyInput
        label="Miscellaneous (weekly cap)"
        value={formData.weekly_misc_cap}
        onValue={(value) => onChange({ weekly_misc_cap: value })}
      />
      <p className="text-sm text-zinc-400">
        These amounts are subtracted from your safe-to-spend as guaranteed weekly needs.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

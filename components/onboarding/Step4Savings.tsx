"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-1)] focus:border-emerald-500 focus:outline-none";
const OPTIONS = [
  { value: "percentage", label: "% of income" },
  { value: "fixed_per_paycheck", label: "Fixed per paycheck" },
  { value: "fixed_per_month", label: "Fixed per month" },
  { value: "leftover", label: "Whatever is left after bills" },
  { value: "manual", label: "Manual only" }
];

export function Step4Savings({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const showValue = !["manual", "leftover"].includes(formData.savings_rule);

  return (
    <StepWrapper
      title="Savings rule"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div className="space-y-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ savings_rule: option.value })}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
              formData.savings_rule === option.value
                ? "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {showValue ? (
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Savings value</label>
          <input
            type="number"
            className={INPUT}
            value={formData.savings_value}
            onChange={(e) => onChange({ savings_value: Number(e.target.value) })}
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

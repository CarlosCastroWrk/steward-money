"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";
const OPTIONS = [
  { value: "manual", label: "Manual only" },
  { value: "fixed_per_paycheck", label: "Fixed per paycheck" },
  { value: "percentage", label: "% of income" },
  { value: "surplus_only", label: "Surplus only" }
];

export function Step5Trading({ formData, onChange, onNext, onBack, onSkip, isSaving, error }: StepProps) {
  const showValue = !["manual", "surplus_only"].includes(formData.trading_rule);

  return (
    <StepWrapper
      title="Trading rule"
      subtitle="How much do you set aside for trading/investing? You can skip this for now."
      onBack={onBack}
      onNext={onNext}
      onSkip={onSkip}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div className="space-y-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ trading_rule: option.value })}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
              formData.trading_rule === option.value
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
          <label className="mb-1 block text-sm text-zinc-400">Trading value</label>
          <input
            type="number"
            className={INPUT}
            value={formData.trading_value}
            onChange={(e) => onChange({ trading_value: Number(e.target.value) })}
          />
        </div>
      ) : null}
      <div className="rounded-lg border border-amber-700 bg-amber-950 p-4 text-sm text-amber-200">
        Trading money should never come from bill money, grocery money, or any funds needed before
        your next paycheck. The app will warn you if a trading contribution would reduce your
        safe-to-spend below your emergency buffer.
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

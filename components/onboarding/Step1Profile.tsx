"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-1)] focus:border-emerald-500 focus:outline-none";
const LABEL = "mb-1 block text-sm text-zinc-400";

export function Step1Profile({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  return (
    <StepWrapper
      title="Profile"
      subtitle="Tell us a little about you."
      onBack={onBack}
      onNext={onNext}
      isFirstStep
      isLastStep={false}
      isSaving={isSaving}
    >
      <div>
        <label className={LABEL}>Your name</label>
        <input
          className={INPUT}
          value={formData.display_name}
          onChange={(e) => onChange({ display_name: e.target.value })}
        />
      </div>
      <div>
        <label className={LABEL}>Currency</label>
        <select
          className={INPUT}
          value={formData.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
        >
          {["USD", "EUR", "GBP", "CAD", "MXN"].map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Life stage</label>
        <select
          className={INPUT}
          value={formData.life_stage}
          onChange={(e) => onChange({ life_stage: e.target.value })}
        >
          {[
            "student",
            "full-time worker",
            "part-time worker",
            "entrepreneur",
            "between jobs",
            "other"
          ].map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>What is your main financial goal?</label>
        <input
          className={INPUT}
          value={formData.main_goal}
          onChange={(e) => onChange({ main_goal: e.target.value })}
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

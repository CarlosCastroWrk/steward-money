"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

function describeSavingsRule(rule: string) {
  const map: Record<string, string> = {
    percentage: "% of income",
    fixed_per_paycheck: "Fixed per paycheck",
    fixed_per_month: "Fixed per month",
    leftover: "Whatever is left after bills",
    manual: "Manual only"
  };
  return map[rule] ?? rule;
}

export function Step10Finish({ formData, onNext, onBack, isSaving, error }: StepProps) {
  const nextPaycheck = [...formData.incomeSources]
    .map((source) => source.next_expected_date)
    .filter(Boolean)
    .sort()[0];

  return (
    <StepWrapper
      title={`Welcome, ${formData.display_name || "there"}`}
      subtitle="Review your setup and finish onboarding."
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep
      isSaving={isSaving}
      hideFooter
    >
      <div className="space-y-2 text-sm text-zinc-300">
        <p>Emergency buffer: ${formData.emergency_buffer.toLocaleString()}</p>
        <p>Savings rule: {describeSavingsRule(formData.savings_rule)}</p>
        <p>Income sources: {formData.incomeSources.length}</p>
        <p>Accounts added: {formData.accounts.length}</p>
        <p>Next expected paycheck: {nextPaycheck || "Not set"}</p>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={isSaving}
        className="w-full rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Go to my dashboard"}
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

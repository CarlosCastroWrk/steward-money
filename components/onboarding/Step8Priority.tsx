"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

export function Step8Priority({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= formData.priorities.length) return;
    const updated = [...formData.priorities];
    [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
    onChange({ priorities: updated });
  };

  return (
    <StepWrapper
      title="Allocation priorities"
      subtitle="Rank 1 is highest priority. This controls how your paycheck is allocated and how decisions are weighed."
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div className="space-y-2">
        {formData.priorities.map((item, index) => (
          <div key={item} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <p className="text-sm text-zinc-200">
              {index + 1}. {item}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === formData.priorities.length - 1}
                onClick={() => move(index, 1)}
                className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

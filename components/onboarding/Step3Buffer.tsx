"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";

export function Step3Buffer({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  const presets = [100, 250, 500, 1000];

  return (
    <StepWrapper
      title="Emergency buffer"
      subtitle="How much should always stay protected in your account?"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ emergency_buffer: value })}
            className={`rounded-lg border px-3 py-2 text-sm ${
              formData.emergency_buffer === value
                ? "border-white bg-white text-black"
                : "border-zinc-700 text-zinc-300"
            }`}
          >
            ${value.toLocaleString()}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Or enter custom amount</label>
        <input
          type="number"
          className={INPUT}
          value={formData.emergency_buffer}
          onChange={(e) => onChange({ emergency_buffer: Number(e.target.value) })}
        />
      </div>
      <p className="text-sm text-zinc-400">
        This amount is never counted in your safe-to-spend. It stays protected at all times.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

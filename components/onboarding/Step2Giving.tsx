"use client";

import { StepWrapper } from "@/components/onboarding/StepWrapper";
import { StepProps } from "@/components/onboarding/types";

const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none";
const LABEL = "mb-1 block text-sm text-zinc-400";

function Toggle({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="h-6 w-11 rounded-full bg-zinc-700 transition peer-checked:bg-zinc-200">
        <span className="ml-1 mt-1 block h-4 w-4 rounded-full bg-zinc-300 transition peer-checked:translate-x-5 peer-checked:bg-zinc-900" />
      </span>
    </label>
  );
}

export function Step2Giving({ formData, onChange, onNext, onBack, isSaving, error }: StepProps) {
  return (
    <StepWrapper
      title="Giving preferences"
      onBack={onBack}
      onNext={onNext}
      isFirstStep={false}
      isLastStep={false}
      isSaving={isSaving}
    >
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-300">Enable giving</label>
        <Toggle checked={formData.giving_enabled} onChange={(value) => onChange({ giving_enabled: value })} />
      </div>
      {formData.giving_enabled ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ giving_type: "percentage" })}
              className={`rounded-lg border px-3 py-2 text-sm ${
                formData.giving_type === "percentage"
                  ? "bg-white text-black"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => onChange({ giving_type: "fixed" })}
              className={`rounded-lg border px-3 py-2 text-sm ${
                formData.giving_type === "fixed" ? "bg-white text-black" : "border-zinc-700 text-zinc-300"
              }`}
            >
              Fixed amount
            </button>
          </div>
          <div>
            <label className={LABEL}>Giving value</label>
            <div className="relative">
              {formData.giving_type === "fixed" ? (
                <span className="absolute left-3 top-2 text-zinc-400">$</span>
              ) : null}
              <input
                type="number"
                className={`${INPUT} ${formData.giving_type === "fixed" ? "pl-7" : "pr-8"}`}
                value={formData.giving_value}
                onChange={(e) => onChange({ giving_value: Number(e.target.value) })}
                placeholder={formData.giving_type === "percentage" ? "10" : "50"}
              />
              {formData.giving_type === "percentage" ? (
                <span className="absolute right-3 top-2 text-zinc-400">%</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-300">
              Protect giving - always deduct this before anything else
            </label>
            <Toggle
              checked={formData.giving_protected}
              onChange={(value) => onChange({ giving_protected: value })}
            />
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </StepWrapper>
  );
}

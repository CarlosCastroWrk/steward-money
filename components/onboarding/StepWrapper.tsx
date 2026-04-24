"use client";

import { ReactNode } from "react";

interface StepWrapperProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNext: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSaving: boolean;
  children: ReactNode;
  hideFooter?: boolean;
}

export function StepWrapper({
  title,
  subtitle,
  onBack,
  onNext,
  isFirstStep,
  isLastStep,
  isSaving,
  children,
  hideFooter
}: StepWrapperProps) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-xl bg-zinc-900 p-6">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-2 text-sm text-zinc-400">{subtitle}</p> : null}
      <div className="mt-6 space-y-4">{children}</div>
      {hideFooter ? null : (
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={isFirstStep || isSaving}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isSaving}
            className="rounded-lg bg-white px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { ReactNode } from "react";

interface StepWrapperProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
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
  onSkip,
  isFirstStep,
  isLastStep,
  isSaving,
  children,
  hideFooter,
}: StepWrapperProps) {
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{subtitle}</p>}
      <div className="mt-5 space-y-4">{children}</div>
      {!hideFooter && (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isFirstStep || isSaving}
            className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={isSaving}
                className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300 disabled:opacity-40"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              disabled={isSaving}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : isLastStep ? "Finish setup" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

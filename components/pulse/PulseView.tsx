"use client";

import { CouncilCards } from "@/components/pulse/CouncilCards";

export function PulseView() {
  return (
    <div className="pb-10 pt-5 md:pt-8">
      <div className="px-4 md:px-8 mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">Council</h1>
        <p className="mt-0.5 text-sm text-[var(--text-3)]">Your ten agents. Tap any to open a conversation.</p>
      </div>
      <div className="px-4 md:px-8">
        <CouncilCards />
      </div>
    </div>
  );
}

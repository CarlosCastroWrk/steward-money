"use client";

import { useState } from "react";
import { LukaVoiceMode } from "@/components/luka/LukaVoiceMode";

export function TalkToLukaButton() {
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setVoiceOpen(true)}
        className="flex items-center gap-2 rounded-2xl border border-purple-700/40 bg-purple-900/10 px-4 py-3 text-sm font-medium text-purple-400 transition hover:bg-purple-900/20 w-full"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 flex-shrink-0">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" />
        </svg>
        Talk to Luka
        <span className="ml-auto text-[10px] text-purple-500/70">voice mode</span>
      </button>

      {voiceOpen && <LukaVoiceMode onClose={() => setVoiceOpen(false)} />}
    </>
  );
}

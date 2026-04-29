"use client";

import { useEffect, useState } from "react";
import { SaveStatus } from "@/components/settings/types";

interface SaveButtonProps {
  onClick: () => void;
  status: SaveStatus;
}

export function SaveButton({ onClick, status }: SaveButtonProps) {
  const [displayStatus, setDisplayStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    setDisplayStatus(status);
    if (status === "saved") {
      const timeout = setTimeout(() => setDisplayStatus("idle"), 2000);
      return () => clearTimeout(timeout);
    }
    if (status === "error") {
      const timeout = setTimeout(() => setDisplayStatus("idle"), 3000);
      return () => clearTimeout(timeout);
    }
    return;
  }, [status]);

  const map = {
    idle: {
      text: "Save changes",
      className: "bg-white/[0.06] border-white/[0.08] text-zinc-300 hover:bg-white/[0.1] hover:text-white"
    },
    saving: {
      text: "Saving...",
      className: "bg-white/[0.04] border-white/[0.06] text-zinc-500 opacity-60 cursor-not-allowed"
    },
    saved: {
      text: "Saved",
      className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
    },
    error: {
      text: "Error — try again",
      className: "bg-red-500/10 border-red-500/30 text-red-400"
    }
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={displayStatus === "saving"}
      className={`rounded-xl border px-5 py-2 text-[13px] font-medium transition-all duration-150 ${map[displayStatus].className}`}
    >
      {map[displayStatus].text}
    </button>
  );
}

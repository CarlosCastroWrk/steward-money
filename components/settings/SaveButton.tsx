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
      className: "border-[var(--color-border)] text-[var(--color-text-muted)]"
    },
    saving: {
      text: "Saving...",
      className: "border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50"
    },
    saved: {
      text: "Saved",
      className: "border-[#1a2e20] text-[var(--color-green)]"
    },
    error: {
      text: "Error - try again",
      className: "border-red-800 text-red-400"
    }
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={displayStatus === "saving"}
      className={`rounded-[8px] border px-4 py-2 text-[11px] font-medium [font-family:var(--font-body)] transition ${map[displayStatus].className}`}
    >
      {map[displayStatus].text}
    </button>
  );
}

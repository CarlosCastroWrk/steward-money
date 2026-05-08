"use client";

import { useEffect, useState } from "react";
import { AgentChat } from "./AgentChat";
import type { AgentName } from "@/lib/agents/registry";

interface OpenPayload {
  agent: AgentName;
  prefill?: string;
  context?: string;
}

export function AgentChatPortal() {
  const [open, setOpen] = useState<OpenPayload | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<OpenPayload>).detail;
      if (detail?.agent) setOpen(detail);
    }
    window.addEventListener("agentchat:open", handler);
    return () => window.removeEventListener("agentchat:open", handler);
  }, []);

  if (!open) return null;

  return (
    <AgentChat
      agent={open.agent}
      prefilledMessage={open.prefill}
      context={open.context}
      onClose={() => setOpen(null)}
    />
  );
}

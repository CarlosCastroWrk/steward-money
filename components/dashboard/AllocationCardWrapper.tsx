"use client";

import { useState } from "react";
import { AllocationCard } from "./AllocationCard";

export function AllocationCardWrapper({ initiallyPending }: { initiallyPending: boolean }) {
  const [pending, setPending] = useState(initiallyPending);
  if (!pending) return null;
  return <AllocationCard onDismiss={() => setPending(false)} />;
}

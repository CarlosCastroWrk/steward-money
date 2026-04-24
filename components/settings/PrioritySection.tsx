"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { PriorityRow, SaveStatus } from "@/components/settings/types";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";

const FALLBACK = ["Giving", "Bills", "Groceries", "Gas", "Savings", "Debt / installments", "Trading account", "Flex spending"];

export function PrioritySection({ initialPriorities }: { initialPriorities: PriorityRow[] }) {
  const initial = useMemo(() => initialPriorities.length ? initialPriorities.map((item) => item.category) : FALLBACK, [initialPriorities]);
  const [priorities, setPriorities] = useState<string[]>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= priorities.length) return;
    const copy = [...priorities];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setPriorities(copy);
  };

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await savePriorities(supabase, user.id, priorities);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Allocation priorities" description="Rank 1 is highest priority.">
      <div className="space-y-2">
        {priorities.map((category, index) => (
          <div key={category} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
            <p className="text-sm text-zinc-200">{index + 1}. {category}</p>
            <div className="flex gap-2">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40">↑</button>
              <button type="button" disabled={index === priorities.length - 1} onClick={() => move(index, 1)} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40">↓</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

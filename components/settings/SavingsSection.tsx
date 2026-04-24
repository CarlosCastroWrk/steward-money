"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { INPUT_CLASS, LABEL_CLASS, SaveStatus, UserSettingsData } from "@/components/settings/types";

const OPTIONS = [
  { value: "percentage", label: "% of income" },
  { value: "fixed_per_paycheck", label: "Fixed per paycheck" },
  { value: "fixed_per_month", label: "Fixed per month" },
  { value: "leftover", label: "Whatever is left after bills" },
  { value: "manual", label: "Manual only" }
];

export function SavingsSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [savings_rule, setSavingsRule] = useState(initialData?.savings_rule ?? "percentage");
  const [savings_value, setSavingsValue] = useState(Number(initialData?.savings_value ?? 10));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { savings_rule, savings_value });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Savings rule">
      <div className="space-y-2 max-w-xl">
        {OPTIONS.map((option) => (
          <button key={option.value} type="button" onClick={() => setSavingsRule(option.value)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${savings_rule === option.value ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300"}`}>
            {option.label}
          </button>
        ))}
      </div>
      {!['manual', 'leftover'].includes(savings_rule) ? (
        <div className="mt-4 max-w-sm">
          <label className={LABEL_CLASS}>Savings value</label>
          <input type="number" className={INPUT_CLASS} value={savings_value} onChange={(e) => setSavingsValue(Number(e.target.value))} />
        </div>
      ) : null}
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

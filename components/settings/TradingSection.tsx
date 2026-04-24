"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { INPUT_CLASS, LABEL_CLASS, SaveStatus, UserSettingsData } from "@/components/settings/types";

const OPTIONS = [
  { value: "manual", label: "Manual only" },
  { value: "fixed_per_paycheck", label: "Fixed per paycheck" },
  { value: "percentage", label: "% of income" },
  { value: "surplus_only", label: "Surplus only" }
];

export function TradingSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [trading_rule, setTradingRule] = useState(initialData?.trading_rule ?? "manual");
  const [trading_value, setTradingValue] = useState(Number(initialData?.trading_value ?? 0));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { trading_rule, trading_value });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Trading rule">
      <div className="space-y-2 max-w-xl">
        {OPTIONS.map((option) => (
          <button key={option.value} type="button" onClick={() => setTradingRule(option.value)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${trading_rule === option.value ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300"}`}>
            {option.label}
          </button>
        ))}
      </div>
      {!['manual', 'surplus_only'].includes(trading_rule) ? (
        <div className="mt-4 max-w-sm">
          <label className={LABEL_CLASS}>Trading value</label>
          <input type="number" className={INPUT_CLASS} value={trading_value} onChange={(e) => setTradingValue(Number(e.target.value))} />
        </div>
      ) : null}
      <div className="mt-4 rounded-lg border border-amber-700 bg-amber-950 p-4 text-sm text-amber-200">
        Trading money should never come from bill money, grocery money, or any funds needed before your next paycheck. The app will warn you if a trading contribution would reduce your safe-to-spend below your emergency buffer.
      </div>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

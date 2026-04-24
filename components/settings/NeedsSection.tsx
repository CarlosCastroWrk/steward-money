"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { INPUT_CLASS, LABEL_CLASS, SaveStatus, UserSettingsData } from "@/components/settings/types";

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-zinc-400">$</span>
        <input type="number" className={`${INPUT_CLASS} pl-7`} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

export function NeedsSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [weekly_groceries_min, setGroceries] = useState(Number(initialData?.weekly_groceries_min ?? 100));
  const [weekly_gas_min, setGas] = useState(Number(initialData?.weekly_gas_min ?? 40));
  const [weekly_eating_out_cap, setEatingOut] = useState(Number(initialData?.weekly_eating_out_cap ?? 60));
  const [weekly_misc_cap, setMisc] = useState(Number(initialData?.weekly_misc_cap ?? 50));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { weekly_groceries_min, weekly_gas_min, weekly_eating_out_cap, weekly_misc_cap });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Weekly needs">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoneyField label="Groceries (per week)" value={weekly_groceries_min} onChange={setGroceries} />
        <MoneyField label="Gas (per week)" value={weekly_gas_min} onChange={setGas} />
        <MoneyField label="Eating out / coffee (weekly cap)" value={weekly_eating_out_cap} onChange={setEatingOut} />
        <MoneyField label="Miscellaneous (weekly cap)" value={weekly_misc_cap} onChange={setMisc} />
      </div>
      <p className="mt-3 text-sm text-zinc-400">These amounts are subtracted from your safe-to-spend as guaranteed weekly needs.</p>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

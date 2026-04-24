"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { INPUT_CLASS, LABEL_CLASS, SaveStatus, UserSettingsData } from "@/components/settings/types";

export function ProfileSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [display_name, setDisplayName] = useState(initialData?.display_name ?? "");
  const [currency, setCurrency] = useState(initialData?.currency ?? "USD");
  const [life_stage, setLifeStage] = useState(initialData?.life_stage ?? "student");
  const [main_goal, setMainGoal] = useState(initialData?.main_goal ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { display_name, currency, life_stage, main_goal });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Profile" description="Update your identity and planning context.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL_CLASS}>Your name</label>
          <input className={INPUT_CLASS} value={display_name} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Currency</label>
          <select className={INPUT_CLASS} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["USD", "EUR", "GBP", "CAD", "MXN"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Life stage</label>
          <select className={INPUT_CLASS} value={life_stage} onChange={(e) => setLifeStage(e.target.value)}>
            {["student", "full-time worker", "part-time worker", "entrepreneur", "between jobs", "other"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Main financial goal</label>
          <input className={INPUT_CLASS} value={main_goal} onChange={(e) => setMainGoal(e.target.value)} />
        </div>
      </div>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

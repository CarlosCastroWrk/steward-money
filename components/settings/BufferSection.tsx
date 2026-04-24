"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { INPUT_CLASS, LABEL_CLASS, SaveStatus, UserSettingsData } from "@/components/settings/types";

export function BufferSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [emergency_buffer, setEmergencyBuffer] = useState(Number(initialData?.emergency_buffer ?? 500));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { emergency_buffer });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Emergency buffer" description="This stays protected from daily spending.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[100, 250, 500, 1000].map((value) => (
          <button key={value} type="button" onClick={() => setEmergencyBuffer(value)} className={`rounded-lg border px-3 py-2 text-sm ${emergency_buffer === value ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300"}`}>
            ${value.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="mt-4 max-w-sm">
        <label className={LABEL_CLASS}>Or enter custom amount</label>
        <input type="number" className={INPUT_CLASS} value={emergency_buffer} onChange={(e) => setEmergencyBuffer(Number(e.target.value))} />
      </div>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { SaveButton } from "@/components/settings/SaveButton";
import { SettingSection } from "@/components/settings/SettingSection";
import { SaveStatus, UserSettingsData, INPUT_CLASS } from "@/components/settings/types";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-11 rounded-full bg-[var(--border-strong)] transition peer-checked:bg-emerald-500">
        <span className="ml-1 mt-1 block h-4 w-4 rounded-full bg-[var(--text-dim)] transition peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}

export function GivingSection({ initialData }: { initialData: UserSettingsData | null }) {
  const [giving_enabled, setGivingEnabled] = useState(Boolean(initialData?.giving_enabled));
  const [giving_type, setGivingType] = useState(initialData?.giving_type === "fixed" ? "fixed" : "percentage");
  const [giving_value, setGivingValue] = useState(Number(initialData?.giving_value ?? 10));
  const [giving_protected, setGivingProtected] = useState(Boolean(initialData?.giving_protected));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const handleSave = async () => {
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      await saveUserSettings(supabase, user.id, { giving_enabled, giving_type, giving_value, giving_protected });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SettingSection title="Giving" description="Set whether and how giving is protected.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">Enable giving</p>
          <Toggle checked={giving_enabled} onChange={setGivingEnabled} />
        </div>
        {giving_enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setGivingType("percentage")} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${giving_type === "percentage" ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>Percentage</button>
              <button type="button" onClick={() => setGivingType("fixed")} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${giving_type === "fixed" ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>Fixed amount</button>
            </div>
            <div className="relative max-w-sm">
              {giving_type === "fixed" ? <span className="absolute left-3 top-2 text-[var(--text-muted)]">$</span> : null}
              <input type="number" className={`${INPUT_CLASS} ${giving_type === "fixed" ? "pl-7" : "pr-8"}`} value={giving_value} onChange={(e) => setGivingValue(Number(e.target.value))} />
              {giving_type === "percentage" ? <span className="absolute right-3 top-2 text-[var(--text-muted)]">%</span> : null}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-secondary)]">Protect giving — always deduct this before anything else</p>
              <Toggle checked={giving_protected} onChange={setGivingProtected} />
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-4"><SaveButton onClick={handleSave} status={status} /></div>
    </SettingSection>
  );
}

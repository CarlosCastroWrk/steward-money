"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { IncomeSourceRow, INPUT_CLASS, LABEL_CLASS } from "@/components/settings/types";
import { SettingSection } from "@/components/settings/SettingSection";

interface IncomeDraft {
  name: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  is_recurring: boolean;
}

const FREQUENCIES = ["weekly", "biweekly", "twice monthly", "monthly", "variable"];

const EMPTY_DRAFT: IncomeDraft = {
  name: "",
  amount: 0,
  frequency: "biweekly",
  next_expected_date: "",
  is_recurring: true
};

export function IncomeSection({ initialSources }: { initialSources: IncomeSourceRow[] }) {
  const [sources, setSources] = useState(initialSources);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IncomeDraft>(EMPTY_DRAFT);

  const beginEdit = (source: IncomeSourceRow) => {
    setEditingId(source.id);
    setDraft({
      name: source.name,
      amount: source.amount,
      frequency: source.frequency,
      next_expected_date: source.next_expected_date,
      is_recurring: source.is_recurring
    });
  };

  const handleAdd = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await saveIncomeSources(supabase, user.id, [draft]);
    const { data } = await supabase
      .from("income_sources")
      .select("id, name, amount, frequency, next_expected_date, is_recurring, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setSources((prev) => [data, ...prev]);
    setDraft(EMPTY_DRAFT);
    setShowAddForm(false);
  };

  const handleEditSave = async (id: string) => {
    const supabase = createClient();
    await supabase.from("income_sources").update(draft).eq("id", id);
    setSources((prev) => prev.map((row) => (row.id === id ? { ...row, ...draft } : row)));
    setEditingId(null);
  };

  const handleRemove = async (id: string) => {
    const supabase = createClient();
    await supabase.from("income_sources").update({ is_active: false }).eq("id", id);
    setSources((prev) => prev.filter((row) => row.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <SettingSection title="Income sources" description="Add, edit, or deactivate expected income.">
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="rounded-lg border border-zinc-800 p-3">
            {editingId === source.id ? (
              <div className="space-y-3">
                <input className={INPUT_CLASS} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input type="number" className={INPUT_CLASS} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
                  <select className={INPUT_CLASS} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}>{FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                  <input type="date" className={INPUT_CLASS} value={draft.next_expected_date} onChange={(e) => setDraft({ ...draft, next_expected_date: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEditSave(source.id)} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">Save changes</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-200">{source.name} - ${source.amount} - {source.frequency} - {source.next_expected_date}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => beginEdit(source)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Edit</button>
                  {confirmDeleteId === source.id ? (
                    <>
                      <button type="button" onClick={() => handleRemove(source.id)} className="rounded-lg border border-red-700 px-3 py-1 text-sm text-red-300">Are you sure?</button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDeleteId(source.id)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Remove</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {showAddForm ? (
        <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 p-4">
          <div>
            <label className={LABEL_CLASS}>Name</label>
            <input className={INPUT_CLASS} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Amount</label>
              <input type="number" className={INPUT_CLASS} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Frequency</label>
              <select className={INPUT_CLASS} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}>{FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Next expected date</label>
              <input type="date" className={INPUT_CLASS} value={draft.next_expected_date} onChange={(e) => setDraft({ ...draft, next_expected_date: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Recurring</label>
            <input type="checkbox" checked={draft.is_recurring} onChange={(e) => setDraft({ ...draft, is_recurring: e.target.checked })} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">Save changes</button>
            <button type="button" onClick={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAddForm(true)} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Add income source</button>
      )}
    </SettingSection>
  );
}

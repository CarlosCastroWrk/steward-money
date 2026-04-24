"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveUserSettings, saveIncomeSources, savePriorities, saveAccounts } from "@/lib/supabase/onboarding";
import { AccountRow, INPUT_CLASS, LABEL_CLASS } from "@/components/settings/types";
import { SettingSection } from "@/components/settings/SettingSection";

interface AccountDraft {
  name: string;
  institution: string;
  type: string;
  current_balance: number;
}

const TYPES = ["checking", "savings", "credit card", "cash", "Apple Cash", "trading", "debt / installment"];
const EMPTY_DRAFT: AccountDraft = { name: "", institution: "", type: "checking", current_balance: 0 };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function AccountsSection({ initialAccounts }: { initialAccounts: AccountRow[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [balanceDraft, setBalanceDraft] = useState(0);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);

  const handleAdd = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await saveAccounts(supabase, user.id, [draft]);
    const { data } = await supabase
      .from("accounts")
      .select("id, name, institution, type, current_balance, is_manual, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setAccounts((prev) => [data, ...prev]);
    setShowAddForm(false);
    setDraft(EMPTY_DRAFT);
  };

  const startEditBalance = (account: AccountRow) => {
    setEditingId(account.id);
    setBalanceDraft(account.current_balance);
  };

  const saveBalance = async (id: string) => {
    const supabase = createClient();
    await supabase.from("accounts").update({ current_balance: balanceDraft }).eq("id", id);
    setAccounts((prev) => prev.map((account) => (account.id === id ? { ...account, current_balance: balanceDraft } : account)));
    setEditingId(null);
  };

  const deactivate = async (id: string) => {
    const supabase = createClient();
    await supabase.from("accounts").update({ is_active: false }).eq("id", id);
    setAccounts((prev) => prev.filter((account) => account.id !== id));
  };

  return (
    <SettingSection title="Accounts" description="Manage your manual account balances.">
      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-zinc-800 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-200">{account.name} {account.institution ? `(${account.institution})` : ""}</p>
                <p className="text-sm text-zinc-400">{account.type} - {formatCurrency(account.current_balance)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-400">Manual</span>
                <button type="button" onClick={() => startEditBalance(account)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Edit balance</button>
                <button type="button" onClick={() => deactivate(account.id)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Deactivate</button>
              </div>
            </div>
            {editingId === account.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="number" className={`${INPUT_CLASS} max-w-xs`} value={balanceDraft} onChange={(e) => setBalanceDraft(Number(e.target.value))} />
                <button type="button" onClick={() => saveBalance(account.id)} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Cancel</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {showAddForm ? (
        <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Name</label>
              <input className={INPUT_CLASS} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Institution</label>
              <input className={INPUT_CLASS} value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} placeholder="e.g. Chase, Wells Fargo" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Type</label>
              <select className={INPUT_CLASS} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Current balance</label>
              <input type="number" className={INPUT_CLASS} value={draft.current_balance} onChange={(e) => setDraft({ ...draft, current_balance: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black">Save changes</button>
            <button type="button" onClick={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAddForm(true)} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Add account</button>
      )}
      <p className="mt-4 text-sm text-zinc-500">Bank connection via Plaid will be available in a future update.</p>
    </SettingSection>
  );
}

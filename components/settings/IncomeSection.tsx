"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveIncomeSources } from "@/lib/supabase/onboarding";
import { advanceIncomeDate } from "@/lib/income";
import type { IncomeSourceRow } from "@/components/settings/types";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/settings/types";
import { SettingSection } from "@/components/settings/SettingSection";

interface IncomeDraft {
  name: string;
  amount: number;
  frequency: string;
  next_expected_date: string;
  is_recurring: boolean;
  is_variable: boolean;
  hourly_rate: number;
  weekly_hours: number;
}

const FREQUENCIES = ["weekly", "biweekly", "twice monthly", "monthly", "variable"];

const EMPTY_DRAFT: IncomeDraft = {
  name: "",
  amount: 0,
  frequency: "biweekly",
  next_expected_date: "",
  is_recurring: true,
  is_variable: false,
  hourly_rate: 0,
  weekly_hours: 0,
};

function estimatedAmount(draft: IncomeDraft): number {
  return draft.is_variable
    ? draft.hourly_rate * draft.weekly_hours
    : draft.amount;
}

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function sourceDisplay(source: IncomeSourceRow): string {
  if (source.is_variable && source.hourly_rate != null && source.weekly_hours != null) {
    const est = source.hourly_rate * source.weekly_hours;
    return `${source.name} — ~${formatUSD(est)}/wk (${source.weekly_hours} hrs @ ${formatUSD(source.hourly_rate)}/hr) — ${source.frequency} — ${source.next_expected_date}`;
  }
  return `${source.name} — ${formatUSD(source.amount)} — ${source.frequency} — ${source.next_expected_date}`;
}

export function IncomeSection({ initialSources }: { initialSources: IncomeSourceRow[] }) {
  const [sources, setSources] = useState(initialSources);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<IncomeDraft>(EMPTY_DRAFT);

  function patch(update: Partial<IncomeDraft>) {
    setDraft((prev) => ({ ...prev, ...update }));
  }

  function beginEdit(source: IncomeSourceRow) {
    setEditingId(source.id);
    setDraft({
      name: source.name,
      amount: source.amount,
      frequency: source.frequency,
      next_expected_date: source.next_expected_date,
      is_recurring: source.is_recurring,
      is_variable: source.is_variable ?? false,
      hourly_rate: source.hourly_rate ?? 0,
      weekly_hours: source.weekly_hours ?? 0,
    });
  }

  async function handleAdd() {
    if (!draft.name.trim() || !draft.next_expected_date) return;
    if (draft.is_variable && (draft.hourly_rate <= 0 || draft.weekly_hours <= 0)) return;
    if (!draft.is_variable && draft.amount <= 0) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await saveIncomeSources(supabase, user.id, [draft]);

    const { data } = await supabase
      .from("income_sources")
      .select("id, name, amount, frequency, next_expected_date, is_recurring, is_active, is_variable, hourly_rate, weekly_hours")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setSources((prev) => [data, ...prev]);
    setDraft(EMPTY_DRAFT);
    setShowAddForm(false);
  }

  async function handleEditSave(id: string) {
    const supabase = createClient();
    const payload = {
      name: draft.name,
      amount: estimatedAmount(draft),
      frequency: draft.frequency,
      next_expected_date: draft.next_expected_date,
      is_recurring: draft.is_recurring,
      is_variable: draft.is_variable,
      hourly_rate: draft.is_variable ? draft.hourly_rate : null,
      weekly_hours: draft.is_variable ? draft.weekly_hours : null,
    };
    await supabase.from("income_sources").update(payload).eq("id", id);
    setSources((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, ...payload }
          : row
      )
    );
    setEditingId(null);
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("income_sources").update({ is_active: false }).eq("id", id);
    setSources((prev) => prev.filter((row) => row.id !== id));
    setConfirmDeleteId(null);
  }

  async function handleMarkReceived(source: IncomeSourceRow) {
    if (!source.next_expected_date) return;
    setReceivingId(source.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReceivingId(null); return; }

    const nextDate = advanceIncomeDate(source.next_expected_date, source.frequency);
    const incomeAmount = source.is_variable && source.hourly_rate != null && source.weekly_hours != null
      ? source.hourly_rate * source.weekly_hours
      : source.amount;

    await Promise.all([
      supabase
        .from("income_sources")
        .update({ next_expected_date: nextDate })
        .eq("id", source.id),
      supabase.from("transactions").insert({
        user_id: user.id,
        date: source.next_expected_date,
        merchant: source.name,
        amount: incomeAmount,
        category: "Income",
        is_recurring: source.is_recurring,
        is_manual: true,
      }),
    ]);

    setSources((prev) =>
      prev.map((s) => s.id === source.id ? { ...s, next_expected_date: nextDate } : s)
    );
    setReceivingId(null);
  }

  const est = estimatedAmount(draft);

  return (
    <SettingSection title="Income sources" description="Add, edit, or deactivate expected income.">
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="rounded-lg border border-[var(--border)] p-3">
            {editingId === source.id ? (
              <IncomeDraftForm
                draft={draft}
                patch={patch}
                onSave={() => handleEditSave(source.id)}
                onCancel={() => setEditingId(null)}
                saveLabel="Save changes"
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-200">{sourceDisplay(source)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkReceived(source)}
                    disabled={receivingId === source.id}
                    className="rounded-lg border border-emerald-800 px-3 py-1 text-sm text-emerald-400 disabled:opacity-40"
                  >
                    {receivingId === source.id ? "..." : "Mark received"}
                  </button>
                  <button
                    type="button"
                    onClick={() => beginEdit(source)}
                    className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
                  >
                    Edit
                  </button>
                  {confirmDeleteId === source.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRemove(source.id)}
                        className="rounded-lg border border-red-700 px-3 py-1 text-sm text-red-300"
                      >
                        Confirm remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(source.id)}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
          <IncomeDraftForm
            draft={draft}
            patch={patch}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setDraft(EMPTY_DRAFT); }}
            saveLabel="Add income source"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(EMPTY_DRAFT); setShowAddForm(true); }}
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
        >
          Add income source
        </button>
      )}
    </SettingSection>
  );
}

// Extracted form so it's shared between add and edit modes
function IncomeDraftForm({
  draft,
  patch,
  onSave,
  onCancel,
  saveLabel,
}: {
  draft: IncomeDraft;
  patch: (u: Partial<IncomeDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const est = draft.is_variable ? draft.hourly_rate * draft.weekly_hours : draft.amount;
  const canSave =
    draft.name.trim().length > 0 &&
    draft.next_expected_date.length > 0 &&
    (draft.is_variable
      ? draft.hourly_rate > 0 && draft.weekly_hours > 0
      : draft.amount > 0);

  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className={LABEL_CLASS}>Name</label>
        <input
          className={INPUT_CLASS}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Freelance, Part-time job"
        />
      </div>

      {/* Variable income toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
        <div>
          <p className="text-sm text-zinc-200">Variable income</p>
          <p className="text-xs text-zinc-500">
            Estimate earnings from hourly rate × weekly hours
          </p>
        </div>
        <button
          type="button"
          onClick={() => patch({ is_variable: !draft.is_variable })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            draft.is_variable ? "bg-purple-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              draft.is_variable ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Amount fields — conditional on is_variable */}
      {draft.is_variable ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Hourly rate ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={INPUT_CLASS}
              value={draft.hourly_rate || ""}
              onChange={(e) => patch({ hourly_rate: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Est. weekly hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className={INPUT_CLASS}
              value={draft.weekly_hours || ""}
              onChange={(e) => patch({ weekly_hours: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
          {est > 0 && (
            <div className="col-span-2 rounded-lg border border-purple-900/50 bg-purple-950/20 px-3 py-2 text-sm text-purple-300">
              Estimated weekly income:{" "}
              <span className="font-semibold">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(est)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className={LABEL_CLASS}>Amount per paycheck ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={INPUT_CLASS}
            value={draft.amount || ""}
            onChange={(e) => patch({ amount: Number(e.target.value) })}
            placeholder="0.00"
          />
        </div>
      )}

      {/* Frequency + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Frequency</label>
          <select
            className={INPUT_CLASS}
            value={draft.frequency}
            onChange={(e) => patch({ frequency: e.target.value })}
          >
            {["weekly", "biweekly", "twice monthly", "monthly", "variable"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Next expected date</label>
          <input
            type="date"
            className={INPUT_CLASS}
            value={draft.next_expected_date}
            onChange={(e) => patch({ next_expected_date: e.target.value })}
          />
        </div>
      </div>

      {/* Recurring toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-400">Recurring</label>
        <input
          type="checkbox"
          checked={draft.is_recurring}
          onChange={(e) => patch({ is_recurring: e.target.checked })}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { AddBillModal } from "./AddBillModal";
import type { Bill, AccountOption } from "./types";

type BillSuggestion = {
  merchant: string;
  amount: number;
  frequency: string;
  occurrences: number;
};

type Props = {
  bills: Bill[];
  accounts: AccountOption[];
  suggestions: BillSuggestion[];
  monthSummary: { totalDue: number; paidTotal: number; stillOwed: number; nextBill: { name: string; daysUntil: number } | null };
};

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function getStatus(bill: Bill): "paid" | "overdue" | "due-soon" | "unpaid" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bill.paid_at) {
    const paidDate = new Date(bill.paid_at);
    if (paidDate.getMonth() === today.getMonth() && paidDate.getFullYear() === today.getFullYear()) return "paid";
  }
  if (!bill.next_due_date) return "unpaid";
  const due = new Date(bill.next_due_date + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "due-soon";
  return "unpaid";
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 999;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.floor((due.getTime() - today.getTime()) / 86400000);
}

function relativeDate(d: string | null): string {
  if (!d) return "No date";
  const diff = daysUntil(d);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function advanceDueDate(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T12:00:00");
  switch (freq) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case "weekly": return (amount * 52) / 12;
    case "biweekly": return (amount * 26) / 12;
    case "quarterly": return amount / 3;
    case "yearly": return amount / 12;
    default: return amount;
  }
}

const STATUS_BADGE: Record<string, string> = {
  paid:      "bg-green-900/50 text-green-400",
  overdue:   "bg-red-900/60 text-red-300",
  "due-soon": "bg-amber-900/60 text-amber-300",
  unpaid:    "bg-zinc-800 text-zinc-400",
};
const STATUS_ROW: Record<string, string> = {
  paid:      "border-zinc-800 bg-zinc-900/50 opacity-70",
  overdue:   "border-red-800 bg-red-950/30",
  "due-soon": "border-amber-800 bg-amber-950/20",
  unpaid:    "border-zinc-800 bg-zinc-900",
};
const STATUS_LABEL: Record<string, string> = {
  paid:      "PAID",
  overdue:   "OVERDUE",
  "due-soon": "DUE SOON",
  unpaid:    "UNPAID",
};

export function BillsView({ bills, accounts, suggestions, monthSummary }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...bills].sort((a, b) => {
    const order = { overdue: 0, "due-soon": 1, unpaid: 2, paid: 3 };
    return (order[getStatus(a)] ?? 2) - (order[getStatus(b)] ?? 2);
  });

  async function markPaid(bill: Bill) {
    if (!bill.next_due_date) return;
    setPaidId(bill.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPaidId(null); return; }
    const next = advanceDueDate(bill.next_due_date, bill.frequency);
    await supabase.from("bills").update({ next_due_date: next, paid_at: new Date().toISOString() }).eq("id", bill.id).eq("user_id", user.id);
    setPaidId(null);
    toast(`${bill.name} marked as paid`);
    router.refresh();
  }

  async function deleteBill(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    if (error) toast("Failed to delete bill", "error");
    else { toast("Bill deleted"); router.refresh(); }
  }

  async function addSuggestion(s: BillSuggestion) {
    setAddingId(s.merchant);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingId(null); return; }
    const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split("T")[0];
    const { error } = await supabase.from("bills").insert({
      user_id: user.id, name: s.merchant, amount: s.amount, frequency: s.frequency, is_autopay: false, next_due_date: nextDueDate,
    });
    setAddingId(null);
    if (error) toast("Failed to add bill", "error");
    else { toast(`${s.merchant} added as a bill`); router.refresh(); }
  }

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Bills</h1>
            <p className="mt-1 text-sm text-zinc-500">Recurring payments — this month&apos;s status</p>
          </div>
          <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-medium hover:bg-zinc-100 transition-colors">
            + Add bill
          </button>
        </div>

        {/* Monthly summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total this month", value: formatUSD(monthSummary.totalDue), color: "text-white" },
            { label: "Paid so far", value: formatUSD(monthSummary.paidTotal), color: "text-green-400" },
            { label: "Still owed", value: formatUSD(monthSummary.stillOwed), color: monthSummary.stillOwed > 0 ? "text-red-400" : "text-zinc-500" },
            {
              label: "Next due",
              value: monthSummary.nextBill
                ? `${monthSummary.nextBill.name} in ${monthSummary.nextBill.daysUntil}d`
                : "None",
              color: "text-amber-400",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{stat.label}</p>
              <p className={`mt-1.5 text-lg font-semibold truncate ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Detected recurring charges */}
        {suggestions.filter((s) => !dismissedSuggestions.has(s.merchant)).length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber-500">Detected recurring charges</p>
            <div className="space-y-2">
              {suggestions.filter((s) => !dismissedSuggestions.has(s.merchant)).map((s) => (
                <div key={s.merchant} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.merchant}</p>
                    <p className="text-xs text-zinc-500">{s.frequency} · {s.occurrences} transactions detected</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{formatUSD(s.amount)}</span>
                    <button type="button" onClick={() => addSuggestion(s)} disabled={addingId === s.merchant}
                      className="rounded-lg border border-green-800/60 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-950/40 disabled:opacity-40 transition-colors">
                      {addingId === s.merchant ? "Adding…" : "Add"}
                    </button>
                    <button type="button" onClick={() => setDismissedSuggestions((p) => new Set([...p, s.merchant]))}
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bills list */}
        <div className="mt-6 space-y-2">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
              <p className="text-sm font-medium text-zinc-400">Nothing due soon. You&apos;re ahead of it.</p>
              <p className="mt-1 text-xs text-zinc-600">Add your recurring payments to start tracking.</p>
            </div>
          ) : (
            sorted.map((bill) => {
              const status = getStatus(bill);
              return (
                <div key={bill.id} className={`rounded-xl border p-4 transition-all ${STATUS_ROW[status]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{bill.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                        {bill.is_autopay && (
                          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">autopay</span>
                        )}
                        {bill.auto_detected_paid && (
                          <span className="rounded-full bg-teal-900/50 px-2 py-0.5 text-[10px] text-teal-400">auto-detected</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {status === "paid"
                          ? `Next due: ${relativeDate(bill.next_due_date)}`
                          : relativeDate(bill.next_due_date)
                        }
                        {" · "}{bill.frequency}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-lg font-semibold text-white">{formatUSD(Number(bill.amount))}</p>
                      {status !== "paid" && !bill.is_autopay && bill.next_due_date && (
                        <button type="button" onClick={() => markPaid(bill)} disabled={paidId === bill.id}
                          className="min-h-[36px] rounded-lg border border-green-800/60 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-950/40 disabled:opacity-40 transition-colors">
                          {paidId === bill.id ? "…" : "Mark paid"}
                        </button>
                      )}
                      <button type="button" onClick={() => { setEditing(bill); setModalOpen(true); }}
                        className="min-h-[36px] rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                        Edit
                      </button>
                      {confirmDeleteId === bill.id ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => deleteBill(bill.id)} disabled={deletingId === bill.id}
                            className="min-h-[36px] rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-40 transition-colors">
                            {deletingId === bill.id ? "…" : "Confirm"}
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-500 transition-colors">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteId(bill.id)}
                          className="min-h-[36px] rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-900 hover:text-red-400 transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddBillModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} accounts={accounts} bill={editing} />
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AddBillModal } from "./AddBillModal";
import type { Bill, AccountOption } from "./types";

type Props = { bills: Bill[]; accounts: AccountOption[] };

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function urgencyOf(d: string | null): "overdue" | "urgent" | "soon" | "fine" | "none" {
  if (!d) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "urgent";
  if (diff <= 7) return "soon";
  return "fine";
}

function relativeDate(d: string | null): string {
  if (!d) return "No date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

const rowClass: Record<string, string> = {
  overdue: "border-red-800 bg-red-950/30",
  urgent: "border-amber-800 bg-amber-950/20",
  soon: "border-yellow-800/40 bg-zinc-900",
  fine: "border-zinc-800 bg-zinc-900",
  none: "border-zinc-800 bg-zinc-900",
};
const badgeClass: Record<string, string> = {
  overdue: "bg-red-900/60 text-red-300",
  urgent: "bg-amber-900/60 text-amber-300",
  soon: "bg-yellow-900/60 text-yellow-300",
  fine: "bg-zinc-800 text-zinc-400",
  none: "bg-zinc-800 text-zinc-500",
};

export function BillsView({ bills, accounts }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);

  const monthlyTotal = bills.reduce((s, b) => s + toMonthly(Number(b.amount), b.frequency), 0);
  const autopayMonthly = bills
    .filter((b) => b.is_autopay)
    .reduce((s, b) => s + toMonthly(Number(b.amount), b.frequency), 0);

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  async function markPaid(bill: Bill) {
    if (!bill.next_due_date) return;
    setPaidId(bill.id);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setPaidId(null); return; }
    const next = advanceDueDate(bill.next_due_date, bill.frequency);
    await supabase.from("bills").update({ next_due_date: next }).eq("id", bill.id).eq("user_id", user.id);
    setPaidId(null);
    router.refresh();
  }

  async function deleteBill(id: string) {
    if (!confirm("Delete this bill?")) return;
    setDeletingId(id);
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    await supabase.from("bills").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    router.refresh();
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(bill: Bill) {
    setEditing(bill);
    setModalOpen(true);
  }

  return (
    <section className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-white">Bills</h1>
            <p className="mt-1 text-sm text-zinc-400">Recurring payments and obligations</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Add bill
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Monthly total</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatUSD(monthlyTotal)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Autopay</p>
            <p className="mt-2 text-xl font-semibold text-emerald-400">{formatUSD(autopayMonthly)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Manual pay</p>
            <p className="mt-2 text-xl font-semibold text-amber-400">
              {formatUSD(monthlyTotal - autopayMonthly)}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {bills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
              <p className="text-zinc-500">No bills yet. Add your first recurring payment.</p>
            </div>
          ) : (
            bills.map((bill) => {
              const u = urgencyOf(bill.next_due_date);
              return (
                <div
                  key={bill.id}
                  className={`flex items-center justify-between rounded-xl border p-4 ${rowClass[u]}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-100">{bill.name}</p>
                      {bill.is_autopay && (
                        <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-400">
                          autopay
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span className={`rounded-full px-2 py-0.5 ${badgeClass[u]}`}>
                        {relativeDate(bill.next_due_date)}
                      </span>
                      <span>·</span>
                      <span>{bill.frequency}</span>
                      {bill.account_id && accountMap[bill.account_id] && (
                        <>
                          <span>·</span>
                          <span>{accountMap[bill.account_id]}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="mr-2 text-lg font-semibold text-white">
                      {formatUSD(Number(bill.amount))}
                    </p>
                    {bill.next_due_date && !bill.is_autopay && (
                      <button
                        type="button"
                        onClick={() => markPaid(bill)}
                        disabled={paidId === bill.id}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-emerald-700 hover:text-emerald-400 disabled:opacity-40"
                      >
                        {paidId === bill.id ? "..." : "Mark paid"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(bill)}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBill(bill.id)}
                      disabled={deletingId === bill.id}
                      className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-red-900 hover:text-red-400 disabled:opacity-40"
                    >
                      {deletingId === bill.id ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddBillModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        accounts={accounts}
        bill={editing}
      />
    </section>
  );
}

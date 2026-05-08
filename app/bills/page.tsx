import { Metadata } from "next";
export const metadata: Metadata = { title: "Expenses" };

import { createClient } from "@/lib/supabase/server";
import { ExpensesView } from "@/components/bills/ExpensesView";
import { BackButton } from "@/components/BackButton";

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case "weekly":    return (amount * 52) / 12;
    case "biweekly":  return (amount * 26) / 12;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
    default:          return amount;
  }
}

export default async function ExpensesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

  const [billsRes, accountsRes, upcomingRes, incomeRes] = await Promise.all([
    supabase.from("bills").select("id, user_id, name, amount, due_day, frequency, is_autopay, next_due_date, account_id, notes, category, created_at, paid_at, auto_detected_paid, is_subscription, subscription_status, value_score").eq("user_id", user.id).order("next_due_date", { ascending: true, nullsFirst: false }),
    supabase.from("accounts").select("id, name, type").eq("user_id", user.id).eq("is_active", true),
    supabase.from("upcoming_expenses").select("id, user_id, name, amount, expense_date, category, notes, is_saving, saved_amount, created_at, is_paid").eq("user_id", user.id).order("expense_date", { ascending: true }),
    supabase.from("income_sources").select("amount, frequency").eq("user_id", user.id).eq("is_active", true),
  ]);

  const bills = billsRes.data ?? [];

  let totalDue = 0;
  let paidTotal = 0;
  let nextBill: { name: string; daysUntil: number } | null = null;

  for (const b of bills) {
    totalDue += toMonthly(Number(b.amount), b.frequency);
    if (b.paid_at) {
      const pd = new Date(b.paid_at);
      if (pd >= new Date(monthStart) && pd <= new Date(monthEnd + "T23:59:59")) {
        paidTotal += Number(b.amount);
      }
    }
    if (!b.paid_at && b.next_due_date && b.next_due_date >= todayStr) {
      const diff = Math.floor((new Date(b.next_due_date + "T00:00:00").getTime() - today.getTime()) / 86400000);
      if (!nextBill || diff < nextBill.daysUntil) nextBill = { name: b.name, daysUntil: diff };
    }
  }

  const stillOwed = Math.max(0, totalDue - paidTotal);
  const monthlyIncome = (incomeRes.data ?? []).reduce((s, src) => s + toMonthly(Number(src.amount), src.frequency), 0);

  return (
    <>
      <div className="px-4 pt-4 md:px-8 md:pt-8"><BackButton /></div>
      <ExpensesView
      bills={bills}
      accounts={accountsRes.data ?? []}
      monthSummary={{ totalDue, paidTotal, stillOwed, nextBill }}
      upcomingExpenses={upcomingRes.data ?? []}
      monthlyIncome={monthlyIncome}
    />
    </>
  );
}

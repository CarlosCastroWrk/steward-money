import { Metadata } from "next";
export const metadata: Metadata = { title: "Expenses" };

import { createClient } from "@/lib/supabase/server";
import { ExpensesView } from "@/components/bills/ExpensesView";

type BillSuggestion = { merchant: string; amount: number; frequency: string; occurrences: number };

function detectRecurring(
  transactions: { merchant: string | null; amount: number; date: string }[],
  existingNames: string[]
): BillSuggestion[] {
  const expenses = transactions.filter((tx) => tx.amount < 0 && tx.merchant);
  const grouped = new Map<string, typeof expenses>();
  for (const tx of expenses) {
    const key = (tx.merchant ?? "").toLowerCase().trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tx);
  }
  const suggestions: BillSuggestion[] = [];
  for (const [key, txs] of grouped) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date + "T12:00:00");
      const d2 = new Date(sorted[i].date + "T12:00:00");
      gaps.push(Math.round((d2.getTime() - d1.getTime()) / 86400000));
    }
    const sorted_gaps = [...gaps].sort((a, b) => a - b);
    const median = sorted_gaps[Math.floor(sorted_gaps.length / 2)];
    let frequency: string | null = null;
    if (median >= 6 && median <= 8) frequency = "weekly";
    else if (median >= 13 && median <= 17) frequency = "biweekly";
    else if (median >= 25 && median <= 35) frequency = "monthly";
    else if (median >= 85 && median <= 95) frequency = "quarterly";
    else if (median >= 355 && median <= 375) frequency = "yearly";
    if (!frequency) continue;
    const already = existingNames.some((n) => n.toLowerCase().includes(key) || key.includes(n.toLowerCase()));
    if (already) continue;
    const avg = txs.reduce((s, tx) => s + Math.abs(tx.amount), 0) / txs.length;
    suggestions.push({ merchant: txs[0].merchant ?? key, amount: Math.round(avg * 100) / 100, frequency, occurrences: txs.length });
  }
  return suggestions.sort((a, b) => b.amount - a.amount).slice(0, 6);
}

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

  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

  const [billsRes, accountsRes, txRes, upcomingRes, incomeRes, silasRes] = await Promise.all([
    supabase.from("bills").select("id, user_id, name, amount, due_day, frequency, is_autopay, next_due_date, account_id, notes, category, created_at, paid_at, auto_detected_paid").eq("user_id", user.id).order("next_due_date", { ascending: true, nullsFirst: false }),
    supabase.from("accounts").select("id, name, type").eq("user_id", user.id).eq("is_active", true),
    supabase.from("transactions").select("id, merchant, amount, date, category").eq("user_id", user.id).lt("amount", 0).eq("is_manual", false).gte("date", startDate).order("date", { ascending: false }),
    supabase.from("upcoming_expenses").select("id, user_id, name, amount, expense_date, category, notes, is_saving, saved_amount, created_at, is_paid").eq("user_id", user.id).order("expense_date", { ascending: true }),
    supabase.from("income_sources").select("amount, frequency").eq("user_id", user.id).eq("is_active", true),
    supabase.from("pulse_insights").select("id, insight_text, insight_type").eq("user_id", user.id).eq("is_active", true).eq("is_dismissed", false).order("confidence_score", { ascending: false }).limit(3),
  ]);

  const bills = billsRes.data ?? [];
  const existingNames = bills.map((b) => b.name);
  const suggestions = detectRecurring(txRes.data ?? [], existingNames);

  // Monthly summary
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

  // Monthly income (estimated)
  const monthlyIncome = (incomeRes.data ?? []).reduce((s, src) => s + toMonthly(Number(src.amount), src.frequency), 0);

  return (
    <ExpensesView
      bills={bills}
      accounts={accountsRes.data ?? []}
      suggestions={suggestions}
      monthSummary={{ totalDue, paidTotal, stillOwed, nextBill }}
      upcomingExpenses={upcomingRes.data ?? []}
      recentTransactions={txRes.data ?? []}
      silasInsights={silasRes.data ?? []}
      monthlyIncome={monthlyIncome}
    />
  );
}

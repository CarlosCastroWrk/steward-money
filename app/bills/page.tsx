import { createClient } from "@/lib/supabase/server";
import { BillsView } from "@/components/bills/BillsView";

type BillSuggestion = {
  merchant: string;
  amount: number;
  frequency: string;
  occurrences: number;
};

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

    const alreadyBill = existingNames.some(
      (name) =>
        name.toLowerCase().includes(key) || key.includes(name.toLowerCase())
    );
    if (alreadyBill) continue;

    const avgAmount = txs.reduce((s, tx) => s + Math.abs(tx.amount), 0) / txs.length;

    suggestions.push({
      merchant: txs[0].merchant ?? key,
      amount: Math.round(avgAmount * 100) / 100,
      frequency,
      occurrences: txs.length,
    });
  }

  return suggestions.sort((a, b) => b.amount - a.amount).slice(0, 6);
}

export default async function BillsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [billsRes, accountsRes, txRes] = await Promise.all([
    supabase
      .from("bills")
      .select("id, user_id, name, amount, due_day, frequency, is_autopay, next_due_date, account_id, notes, created_at")
      .eq("user_id", user.id)
      .order("next_due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("transactions")
      .select("merchant, amount, date")
      .eq("user_id", user.id)
      .eq("is_manual", false)
      .gte("date", startDate),
  ]);

  const bills = billsRes.data ?? [];
  const existingNames = bills.map((b) => b.name);
  const suggestions = detectRecurring(txRes.data ?? [], existingNames);

  return (
    <BillsView
      bills={bills}
      accounts={accountsRes.data ?? []}
      suggestions={suggestions}
    />
  );
}

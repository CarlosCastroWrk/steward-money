"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Plus, Home, Car, Smartphone, Zap, Heart, GraduationCap, CreditCard, Tv, Box, Check, ChevronDown, ChevronUp, Search, X, RefreshCw } from "lucide-react";
import { AddExpenseSheet } from "./AddExpenseSheet";
import type { Bill, AccountOption, UpcomingExpense, RecentTx } from "./types";
import type { RecurringPrefill } from "./AddExpenseSheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "recurring" | "upcoming" | "recent";
type BillStatus = "paid" | "overdue" | "due-soon" | "unpaid";
type RecentFilter = "month" | "last-month" | "3months";

interface Suggestion {
  merchant: string;
  amount: number;
  frequency: string;
  occurrences: number;
}

interface MonthSummary {
  totalDue: number;
  paidTotal: number;
  stillOwed: number;
  nextBill: { name: string; daysUntil: number } | null;
}

interface SilasInsight {
  id: string;
  insight_text: string;
  insight_type: string;
}

interface Props {
  bills: Bill[];
  accounts: AccountOption[];
  suggestions: Suggestion[];
  monthSummary: MonthSummary;
  upcomingExpenses: UpcomingExpense[];
  recentTransactions: RecentTx[];
  silasInsights: SilasInsight[];
  monthlyIncome: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  housing:       { label: "Housing",       Icon: Home,           color: "bg-blue-500" },
  transport:     { label: "Transport",     Icon: Car,            color: "bg-amber-500" },
  phone:         { label: "Phone",         Icon: Smartphone,     color: "bg-purple-500" },
  utilities:     { label: "Utilities",     Icon: Zap,            color: "bg-yellow-400" },
  health:        { label: "Health",        Icon: Heart,          color: "bg-red-500" },
  education:     { label: "Education",     Icon: GraduationCap,  color: "bg-green-500" },
  debt:          { label: "Debt",          Icon: CreditCard,     color: "bg-orange-500" },
  entertainment: { label: "Entertainment", Icon: Tv,             color: "bg-pink-500" },
  other:         { label: "Other",         Icon: Box,            color: "bg-zinc-500" },
};

const PLAID_CATEGORY_MAP: Record<string, string> = {
  "food and drink":      "Food",
  "food_and_drink":      "Food",
  "travel":              "Travel",
  "transportation":      "Transport",
  "shops":               "Shopping",
  "shopping":            "Shopping",
  "entertainment":       "Entertainment",
  "healthcare":          "Health",
  "health":              "Health",
  "utilities":           "Utilities",
  "education":           "Education",
  "general merchandise": "Shopping",
  "general_merchandise": "Shopping",
  "personal care":       "Personal",
  "personal_care":       "Personal",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function getStatus(bill: Bill): BillStatus {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (bill.paid_at) {
    const pd = new Date(bill.paid_at);
    if (pd.getMonth() === today.getMonth() && pd.getFullYear() === today.getFullYear()) return "paid";
  }
  if (!bill.next_due_date) return "unpaid";
  const due = new Date(bill.next_due_date + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "due-soon";
  return "unpaid";
}

function daysUntilDate(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

function relativeDate(d: string | null): string {
  if (!d) return "No date set";
  const diff = daysUntilDate(d);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function advanceDueDate(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T12:00:00");
  switch (freq) {
    case "weekly":    d.setDate(d.getDate() + 7); break;
    case "biweekly":  d.setDate(d.getDate() + 14); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
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

function mapPlaidCategory(cat: string | null): string {
  if (!cat) return "Other";
  const lower = cat.toLowerCase();
  return PLAID_CATEGORY_MAP[lower] ?? cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExpensesView({
  bills,
  accounts,
  suggestions,
  monthSummary,
  upcomingExpenses,
  recentTransactions,
  silasInsights,
  monthlyIncome,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("recurring");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"recurring" | "upcoming">("recurring");
  const [prefill, setPrefill] = useState<RecurringPrefill | undefined>(undefined);

  // Recurring tab state
  const [recurringFilter, setRecurringFilter] = useState<"all" | "bills" | "subscriptions">("all");
  const [paidId, setPaidId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [paidSectionOpen, setPaidSectionOpen] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [monthResetDismissed, setMonthResetDismissed] = useState(true); // start true, check in useEffect

  // Upcoming tab state
  const [deletingUpcomingId, setDeletingUpcomingId] = useState<string | null>(null);
  const [confirmDeleteUpcomingId, setConfirmDeleteUpcomingId] = useState<string | null>(null);
  const [markingPaidUpcomingId, setMarkingPaidUpcomingId] = useState<string | null>(null);

  // Recent tab state
  const [recentFilter, setRecentFilter] = useState<RecentFilter>("month");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  // Month-reset banner
  useEffect(() => {
    const today = new Date();
    const key = `steward-month-reset-${today.getFullYear()}-${today.getMonth()}`;
    const dismissed = localStorage.getItem(key) === "1";
    if (!dismissed && today.getDate() === 1) {
      setMonthResetDismissed(false);
    }
  }, []);

  function dismissMonthReset() {
    const today = new Date();
    const key = `steward-month-reset-${today.getFullYear()}-${today.getMonth()}`;
    localStorage.setItem(key, "1");
    setMonthResetDismissed(true);
  }

  // ── Recurring actions ──────────────────────────────────────────────────────

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

  async function deleteExpense(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingId(null); return; }
    const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", user.id);
    setDeletingId(null);
    if (error) toast("Failed to delete expense", "error");
    else { toast("Expense deleted"); router.refresh(); }
  }

  async function addSuggestion(s: Suggestion) {
    setDismissedSuggestions((p) => new Set([...p, s.merchant]));
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split("T")[0];
    const { error } = await supabase.from("bills").insert({
      user_id: user.id, name: s.merchant, amount: s.amount, frequency: s.frequency, is_autopay: false, next_due_date: nextDueDate,
    });
    if (error) toast("Failed to add expense", "error");
    else { toast(`${s.merchant} added`); router.refresh(); }
  }

  // ── Upcoming actions ───────────────────────────────────────────────────────

  async function deleteUpcoming(id: string) {
    setDeletingUpcomingId(id);
    setConfirmDeleteUpcomingId(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingUpcomingId(null); return; }
    const { error } = await supabase.from("upcoming_expenses").delete().eq("id", id).eq("user_id", user.id);
    setDeletingUpcomingId(null);
    if (error) toast("Failed to delete", "error");
    else { toast("Removed"); router.refresh(); }
  }

  async function markUpcomingPaid(exp: UpcomingExpense) {
    setMarkingPaidUpcomingId(exp.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingPaidUpcomingId(null); return; }
    await supabase.from("upcoming_expenses").update({ is_paid: true }).eq("id", exp.id).eq("user_id", user.id);
    setMarkingPaidUpcomingId(null);
    toast(`${exp.name} marked as paid`);
    router.refresh();
  }

  // ── "Add as recurring" from Recent ────────────────────────────────────────

  function addAsRecurring(tx: RecentTx) {
    setPrefill({
      name: tx.merchant ?? "",
      amount: Math.abs(tx.amount),
      frequency: "monthly",
    });
    setSheetMode("recurring");
    setSheetOpen(true);
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const STATUS_ORDER: Record<BillStatus, number> = { overdue: 0, "due-soon": 1, unpaid: 2, paid: 3 };
  const filteredBills = bills.filter((b) => {
    if (recurringFilter === "bills") return !b.is_subscription;
    if (recurringFilter === "subscriptions") return b.is_subscription;
    return true;
  });
  const sortedBills = [...filteredBills].sort((a, b) => STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]);
  const unpaidBills = sortedBills.filter((b) => getStatus(b) !== "paid");
  const paidBills = sortedBills.filter((b) => getStatus(b) === "paid");

  const unpaidUpcoming = upcomingExpenses.filter((e) => !e.is_paid).sort((a, b) => a.expense_date.localeCompare(b.expense_date));
  const paidUpcoming = upcomingExpenses.filter((e) => e.is_paid);

  // Category totals for breakdown
  const categoryTotals: Record<string, number> = {};
  for (const bill of bills) {
    const cat = bill.category ?? "other";
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + toMonthly(Number(bill.amount), bill.frequency);
  }
  const totalMonthly = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // Income ratio
  const incomeRatio = monthlyIncome > 0 ? Math.round((monthSummary.totalDue / monthlyIncome) * 100) : 0;
  const ratioColor = incomeRatio < 60 ? "text-[var(--color-income)]" : incomeRatio < 80 ? "text-[var(--color-warning)]" : "text-[var(--color-expense)]";

  // Progress
  const progressPct = monthSummary.totalDue > 0
    ? Math.min(100, Math.round((monthSummary.paidTotal / monthSummary.totalDue) * 100))
    : 0;

  // Recent filtering
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const filterCutoff = recentFilter === "month" ? monthStart : recentFilter === "last-month" ? lastMonthStart : threeMonthsAgo;
  const filterEnd = recentFilter === "last-month" ? monthStart : new Date();

  const filteredRecent = recentTransactions
    .filter((tx) => {
      const d = new Date(tx.date + "T00:00:00");
      if (d < filterCutoff || d >= filterEnd) return false;
      if (categoryFilter && mapPlaidCategory(tx.category).toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (search && !((tx.merchant ?? "").toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // Group recent by date
  const recentByDate = new Map<string, typeof filteredRecent>();
  for (const tx of filteredRecent) {
    if (!recentByDate.has(tx.date)) recentByDate.set(tx.date, []);
    recentByDate.get(tx.date)!.push(tx);
  }

  // Unique categories in recent transactions for filter chips
  const recentCategories = [...new Set(recentTransactions.map((tx) => mapPlaidCategory(tx.category)).filter(Boolean))].sort();

  function openSheet(mode: "recurring" | "upcoming") {
    setPrefill(undefined);
    setSheetMode(mode);
    setSheetOpen(true);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="min-h-screen pb-10">
      {/* Page header */}
      <div className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-4 md:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Expenses</h1>
            <p className="text-xs text-[var(--text-muted)]">Your complete expense command center</p>
          </div>
          <button
            type="button"
            onClick={() => openSheet(activeTab === "upcoming" ? "upcoming" : "recurring")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:bg-[var(--accent-deep)] active:scale-95"
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 md:px-8">

        {/* ── Month-reset banner ─────────────────────────────────────────── */}
        {!monthResetDismissed && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">
              New month. <span className="font-medium text-[var(--text-primary)]">{unpaidBills.length} expenses</span> reset. Time to cover your obligations.
            </p>
            <button type="button" onClick={dismissMonthReset} className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Summary card ───────────────────────────────────────────────── */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Three numbers */}
          <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] px-0">
            {[
              { label: "This month", value: fmt(monthSummary.totalDue), sub: "" },
              { label: "Paid",       value: fmt(monthSummary.paidTotal), color: "text-[var(--color-income)]" },
              { label: "Remaining",  value: fmt(monthSummary.stillOwed), color: monthSummary.stillOwed > 0 ? "text-[var(--color-expense)]" : "text-[var(--text-muted)]" },
            ].map((item) => (
              <div key={item.label} className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
                <p className={`mt-1 font-mono text-lg font-semibold ${item.color ?? "text-[var(--text-primary)]"}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
              <div
                className="h-1.5 rounded-full bg-[var(--color-income)] transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-secondary)]">{progressPct}%</span> of monthly expenses covered
            </p>
          </div>

          {/* Next due + income ratio */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
            {monthSummary.nextBill ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                monthSummary.nextBill.daysUntil <= 3
                  ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
              }`}>
                {monthSummary.nextBill.name} due {monthSummary.nextBill.daysUntil === 0 ? "today" : `in ${monthSummary.nextBill.daysUntil}d`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-income)]/10 px-3 py-1 text-xs font-medium text-[var(--color-income)]">
                <Check size={11} strokeWidth={2.5} /> All caught up
              </span>
            )}
            {monthlyIncome > 0 && (
              <span className={`text-[11px] ${ratioColor}`}>
                <span className="font-semibold">{incomeRatio}%</span> of income committed
              </span>
            )}
          </div>
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="mt-5 flex border-b border-[var(--border-subtle)]">
          {(["recurring", "upcoming", "recent"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                activeTab === tab
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-[var(--accent)]" />
              )}
              {tab === "upcoming" && upcomingExpenses.filter((e) => !e.is_paid).length > 0 && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[9px] font-bold text-[var(--accent)]">
                  {upcomingExpenses.filter((e) => !e.is_paid).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ RECURRING TAB ════════════════════════════════════════════════ */}
        {activeTab === "recurring" && (
          <div className="mt-4 space-y-3">

            {/* Filter chips */}
            <div className="flex gap-2">
              {(["all", "bills", "subscriptions"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRecurringFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                    recurringFilter === f
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Silas insights */}
            {silasInsights.filter((i) => !dismissedInsights.has(i.id)).slice(0, 1).map((insight) => (
              <div key={insight.id} className="flex items-start justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-teal-400">S</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{insight.insight_text}</p>
                </div>
                <button type="button" onClick={() => setDismissedInsights((p) => new Set([...p, insight.id]))} className="flex-shrink-0 text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                  <X size={13} />
                </button>
              </div>
            ))}

            {/* Detected recurring charges */}
            {suggestions.filter((s) => !dismissedSuggestions.has(s.merchant)).length > 0 && (
              <div className="rounded-2xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-warning)]">Recurring charges we found</p>
                <p className="mb-3 text-xs text-[var(--text-muted)]">We spotted these in your transactions. Add the ones you want to track.</p>
                <div className="space-y-2">
                  {suggestions.filter((s) => !dismissedSuggestions.has(s.merchant)).map((s) => (
                    <div key={s.merchant} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{s.merchant}</p>
                        <p className="text-xs text-[var(--text-muted)]">{s.frequency} · {s.occurrences}× detected</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{fmt(s.amount)}</span>
                        <button type="button" onClick={() => addSuggestion(s)}
                          className="rounded-lg border border-[var(--color-income)]/30 px-3 py-1 text-[11px] font-semibold text-[var(--color-income)] hover:bg-[var(--color-income)]/10 transition-colors">
                          Add
                        </button>
                        <button type="button" onClick={() => setDismissedSuggestions((p) => new Set([...p, s.merchant]))}
                          className="text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unpaid/due expense cards */}
            {unpaidBills.length === 0 && paidBills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)]">No recurring expenses yet.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Add your rent, subscriptions, and monthly obligations.</p>
                <button type="button" onClick={() => openSheet("recurring")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:bg-[var(--accent-deep)] transition-all">
                  <Plus size={14} /> Add expense
                </button>
              </div>
            ) : (
              <>
                {unpaidBills.map((bill) => <BillCard key={bill.id} bill={bill} paidId={paidId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} onMarkPaid={markPaid} onDelete={deleteExpense} onConfirmDelete={setConfirmDeleteId} />)}

                {/* Paid section (collapsible) */}
                {paidBills.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setPaidSectionOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      <span>{paidBills.length} paid this month</span>
                      {paidSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {paidSectionOpen && (
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {paidBills.map((bill) => <BillCard key={bill.id} bill={bill} paidId={paidId} deletingId={deletingId} confirmDeleteId={confirmDeleteId} onMarkPaid={markPaid} onDelete={deleteExpense} onConfirmDelete={setConfirmDeleteId} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Category breakdown */}
            {sortedCategories.length > 0 && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">By Category</p>
                <div className="space-y-3">
                  {sortedCategories.map(([cat, total]) => {
                    const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                    const pct = totalMonthly > 0 ? Math.round((total / totalMonthly) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <meta.Icon size={13} strokeWidth={1.8} className="text-[var(--text-muted)]" />
                            <span className="text-[12px] text-[var(--text-secondary)]">{meta.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] text-[var(--text-secondary)]">{fmt(total)}</span>
                            <span className="w-8 text-right text-[11px] text-[var(--text-dim)]">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                          <div className={`h-1 rounded-full ${meta.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ UPCOMING TAB ═════════════════════════════════════════════════ */}
        {activeTab === "upcoming" && (
          <div className="mt-4 space-y-3">
            {unpaidUpcoming.length === 0 && paidUpcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)]">No upcoming expenses planned.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Add concerts, car registration, gifts. Steward ahead.</p>
                <button type="button" onClick={() => openSheet("upcoming")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:bg-[var(--accent-deep)] transition-all">
                  <Plus size={14} /> Add upcoming
                </button>
              </div>
            ) : (
              <>
                {unpaidUpcoming.map((exp) => {
                  const days = daysUntilDate(exp.expense_date);
                  const isClose = days >= 0 && days <= 7;
                  const isPast = days < 0;
                  const meta = CATEGORY_META[exp.category ?? "other"] ?? CATEGORY_META.other;
                  return (
                    <div key={exp.id} className={`rounded-2xl border p-4 ${isPast ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5" : isClose ? "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5" : "border-[var(--border-default)] bg-[var(--bg-card)]"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${isPast ? "bg-[var(--color-danger)]/20" : isClose ? "bg-[var(--color-warning)]/20" : "bg-[var(--bg-elevated)]"}`}>
                            <meta.Icon size={16} strokeWidth={1.8} className={isPast ? "text-[var(--color-expense)]" : isClose ? "text-[var(--color-warning)]" : "text-[var(--text-muted)]"} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{exp.name}</p>
                            <p className={`text-xs ${isPast ? "text-[var(--color-expense)]" : isClose ? "text-[var(--color-warning)]" : "text-[var(--text-muted)]"}`}>
                              {isPast ? `${Math.abs(days)}d past` : days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`}
                              {" · "}{new Date(exp.expense_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-semibold text-[var(--text-primary)]">{fmt(Number(exp.amount))}</span>
                          <button type="button" onClick={() => markUpcomingPaid(exp)} disabled={markingPaidUpcomingId === exp.id}
                            className="rounded-lg border border-[var(--color-income)]/30 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-income)] hover:bg-[var(--color-income)]/10 disabled:opacity-40 transition-colors">
                            {markingPaidUpcomingId === exp.id ? "…" : "Paid"}
                          </button>
                          {confirmDeleteUpcomingId === exp.id ? (
                            <>
                              <button type="button" onClick={() => deleteUpcoming(exp.id)} disabled={deletingUpcomingId === exp.id}
                                className="rounded-lg border border-[var(--color-danger)]/40 px-2.5 py-1 text-[11px] text-[var(--color-expense)] hover:bg-[var(--color-danger)]/10 disabled:opacity-40 transition-colors">
                                {deletingUpcomingId === exp.id ? "…" : "Confirm"}
                              </button>
                              <button type="button" onClick={() => setConfirmDeleteUpcomingId(null)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><X size={13} /></button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setConfirmDeleteUpcomingId(exp.id)} className="text-[var(--text-dim)] hover:text-[var(--color-expense)] transition-colors"><X size={14} /></button>
                          )}
                        </div>
                      </div>
                      {exp.notes && <p className="mt-2 text-xs text-[var(--text-muted)] pl-12">{exp.notes}</p>}
                    </div>
                  );
                })}

                {paidUpcoming.length > 0 && (
                  <p className="text-center text-xs text-[var(--text-dim)]">{paidUpcoming.length} paid upcoming expenses hidden</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ RECENT TAB ═══════════════════════════════════════════════════ */}
        {activeTab === "recent" && (
          <div className="mt-4 space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                <RefreshCw size={28} strokeWidth={1.4} className="mx-auto mb-3 text-[var(--text-dim)]" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No transactions yet.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Connect your bank to see recent expenses automatically.</p>
                <a href="/accounts" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:bg-[var(--accent-deep)] transition-all">
                  Connect bank
                </a>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                <div className="space-y-2">
                  {/* Time period */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(["month", "last-month", "3months"] as RecentFilter[]).map((f) => (
                      <button key={f} type="button" onClick={() => setRecentFilter(f)}
                        className={`flex-shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                          recentFilter === f
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                            : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                        }`}>
                        {f === "month" ? "This month" : f === "last-month" ? "Last month" : "3 months"}
                      </button>
                    ))}
                  </div>

                  {/* Search + category chips */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] py-2.5 pl-8 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
                      placeholder="Search merchant…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {recentCategories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {recentCategories.slice(0, 8).map((cat) => (
                        <button key={cat} type="button" onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                          className={`flex-shrink-0 rounded-full border px-3 py-1 text-[11px] transition-all ${
                            categoryFilter === cat
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                              : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                          }`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grouped transactions */}
                {filteredRecent.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">No transactions match your filters.</p>
                ) : (
                  [...recentByDate.entries()].map(([date, txs]) => {
                    const dayTotal = txs.reduce((s, tx) => s + Math.abs(tx.amount), 0);
                    const label = (() => {
                      const diff = daysUntilDate(date);
                      if (diff === 0) return "Today";
                      if (diff === -1) return "Yesterday";
                      return new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    })();
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</span>
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">{fmt(dayTotal)}</span>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-subtle)]">
                          {txs.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between px-4 py-3 gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{tx.merchant ?? "Unknown"}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{mapPlaidCategory(tx.category)}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-mono text-sm font-semibold text-[var(--color-expense)]">-{fmt(Math.abs(tx.amount))}</span>
                                <button
                                  type="button"
                                  onClick={() => addAsRecurring(tx)}
                                  className="rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
                                >
                                  + Recurring
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Add expense bottom sheet ──────────────────────────────────────── */}
      <AddExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={sheetMode}
        accounts={accounts}
        prefill={prefill}
        onSuccess={() => {}}
      />
    </section>
  );
}

// ─── BillCard sub-component ──────────────────────────────────────────────────

function BillCard({
  bill, paidId, deletingId, confirmDeleteId, onMarkPaid, onDelete, onConfirmDelete,
}: {
  bill: Bill;
  paidId: string | null;
  deletingId: string | null;
  confirmDeleteId: string | null;
  onMarkPaid: (b: Bill) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
}) {
  const status = getStatus(bill);
  const meta = CATEGORY_META[bill.category ?? "other"] ?? CATEGORY_META.other;

  const rowStyle: Record<BillStatus, string> = {
    paid:      "border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-60",
    overdue:   "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5",
    "due-soon": "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5",
    unpaid:    "border-[var(--border-default)] bg-[var(--bg-card)]",
  };

  const badgeStyle: Record<BillStatus, string> = {
    paid:      "bg-[var(--color-income)]/15 text-[var(--color-income)]",
    overdue:   "bg-[var(--color-danger)]/15 text-[var(--color-expense)]",
    "due-soon": "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    unpaid:    "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
  };

  const badgeLabel: Record<BillStatus, string> = {
    paid: "Paid", overdue: "Overdue", "due-soon": "Due soon", unpaid: "Upcoming",
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all ${rowStyle[status]}`}>
      <div className="flex items-center gap-3">
        {/* Category icon */}
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${status === "overdue" ? "bg-[var(--color-danger)]/20" : status === "due-soon" ? "bg-[var(--color-warning)]/20" : "bg-[var(--bg-elevated)]"}`}>
          <meta.Icon size={16} strokeWidth={1.8} className={status === "overdue" ? "text-[var(--color-expense)]" : status === "due-soon" ? "text-[var(--color-warning)]" : "text-[var(--text-muted)]"} />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">{bill.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeStyle[status]}`}>
              {badgeLabel[status]}
            </span>
            {bill.is_autopay && (
              <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">autopay</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {status === "paid" ? `Next: ${relativeDate(bill.next_due_date)}` : relativeDate(bill.next_due_date)}
            {" · "}{bill.frequency}
          </p>
        </div>

        {/* Amount + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-base font-semibold text-[var(--text-primary)]">{fmt(Number(bill.amount))}</span>
          {status !== "paid" && !bill.is_autopay && bill.next_due_date && (
            <button type="button" onClick={() => onMarkPaid(bill)} disabled={paidId === bill.id}
              className="rounded-xl border border-[var(--color-income)]/30 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-income)] hover:bg-[var(--color-income)]/10 disabled:opacity-40 transition-colors">
              {paidId === bill.id ? "…" : "Mark paid"}
            </button>
          )}
          {confirmDeleteId === bill.id ? (
            <>
              <button type="button" onClick={() => onDelete(bill.id)} disabled={deletingId === bill.id}
                className="rounded-xl border border-[var(--color-danger)]/40 px-3 py-1.5 text-[11px] text-[var(--color-expense)] hover:bg-[var(--color-danger)]/10 disabled:opacity-40 transition-colors">
                {deletingId === bill.id ? "…" : "Confirm"}
              </button>
              <button type="button" onClick={() => onConfirmDelete(null)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]"><X size={13} /></button>
            </>
          ) : (
            <button type="button" onClick={() => onConfirmDelete(bill.id)} className="text-[var(--text-dim)] hover:text-[var(--color-expense)] transition-colors"><X size={14} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

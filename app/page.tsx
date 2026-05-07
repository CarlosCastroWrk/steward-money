import { Metadata } from "next";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatUSDCents, formatDate } from "@/lib/format";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";

export const metadata: Metadata = {
  title: "Dashboard — Steward Money",
};

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case "weekly":    return (amount * 52) / 12;
    case "biweekly":  return (amount * 26) / 12;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
    default:          return amount;
  }
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  await advanceStaleIncomeDates(supabase, user.id);

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [
    result,
    goalsResult,
    settingsResult,
    upcomingBillsResult,
    allBillsResult,
    subsResult,
    spendingRes,
    alertsResult,
    upcomingExpensesWeekResult,
    upcomingExpensesMonthResult,
    recentTxResult,
    lastSyncedResult,
  ] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", user.id).order("priority", { ascending: true }),
    supabase.from("user_settings").select("display_name, last_plan_review").eq("user_id", user.id).maybeSingle(),
    supabase.from("bills").select("id, name, amount, next_due_date, is_autopay").eq("user_id", user.id).not("next_due_date", "is", null).gte("next_due_date", today).lte("next_due_date", sevenDaysOut).order("next_due_date", { ascending: true }),
    supabase.from("bills").select("name, amount, frequency, next_due_date").eq("user_id", user.id),
    supabase.from("bills").select("amount, subscription_status").eq("user_id", user.id).eq("is_subscription", true),
    supabase.from("transactions").select("amount").eq("user_id", user.id).lt("amount", 0).gte("date", monthStart),
    supabase.from("alerts").select("id, message, severity, alert_type").eq("user_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(2),
    supabase.from("upcoming_expenses").select("id, name, amount, expense_date").eq("user_id", user.id).eq("is_paid", false).gte("expense_date", today).lte("expense_date", sevenDaysOut).order("expense_date", { ascending: true }),
    supabase.from("upcoming_expenses").select("amount").eq("user_id", user.id).eq("is_paid", false).gte("expense_date", monthStart),
    supabase.from("transactions").select("id, merchant, amount, date, category").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }).limit(5),
    supabase.from("accounts").select("last_synced").eq("user_id", user.id).not("last_synced", "is", null).order("last_synced", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const goals = goalsResult.data ?? [];
  const displayName = (settingsResult.data?.display_name ?? "there").trim();
  const upcomingBills = upcomingBillsResult.data ?? [];
  const alerts = alertsResult.data ?? [];

  const monthlyRecurringTotal = (allBillsResult.data ?? []).reduce((s, b) => s + toMonthly(Number(b.amount), b.frequency), 0);
  const monthlyUpcomingTotal = (upcomingExpensesMonthResult.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const monthlyBillsTotal = monthlyRecurringTotal + monthlyUpcomingTotal;
  const totalSpentMonth = (spendingRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const monthlySubsTotal = (subsResult.data ?? []).filter((s) => s.subscription_status === "keep" || s.subscription_status == null).reduce((s, sub) => s + Number(sub.amount), 0);

  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const recentTx = recentTxResult.data ?? [];
  const lastSynced = lastSyncedResult.data?.last_synced ?? null;
  const lastSyncedLabel = lastSynced
    ? (() => {
        const secs = Math.floor((Date.now() - new Date(lastSynced).getTime()) / 1000);
        if (secs < 60) return "Synced just now";
        if (secs < 3600) return `Synced ${Math.floor(secs / 60)}m ago`;
        if (secs < 86400) return `Synced ${Math.floor(secs / 3600)}h ago`;
        return `Synced ${Math.floor(secs / 86400)}d ago`;
      })()
    : null;

  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:space-y-6 md:px-8 md:pt-8">

      {/* 1. Greeting + date */}
      <GreetingHeader displayName={displayName} />

      {/* 2. Argus alerts — urgent only, max 2 */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-3 text-sm ${
                alert.severity === "danger"
                  ? "border-red-900/50 bg-red-950/40 text-red-300"
                  : alert.severity === "info"
                  ? "border-zinc-700/50 bg-zinc-900 text-zinc-400"
                  : "border-amber-900/50 bg-amber-950/40 text-amber-300"
              }`}
            >
              {alert.message}
            </div>
          ))}
          <a href="/pulse" className="self-end text-xs text-purple-400 hover:text-purple-300">
            View all in Pulse →
          </a>
        </div>
      )}

      {/* 3. Safe-to-spend hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3d1f7d] via-[#4a1d96] to-[#2a1f6e] p-6 shadow-2xl shadow-purple-900/40">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-4 h-28 w-52 rounded-full bg-purple-400/10 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Safe to Spend</p>
          <p className={`mt-1.5 text-5xl font-bold leading-none tracking-tight ${result.safeToSpendRaw < 0 ? "text-red-400" : "text-white"}`}>
            {formatUSD(result.safeToSpend)}
          </p>
          <p className="mt-1.5 text-xs text-white/40">After bills, buffer &amp; deductions</p>
          {lastSyncedLabel && (
            <a href="/transactions" className="mt-1 inline-block text-[10px] text-white/30 hover:text-white/50 transition-colors">
              {lastSyncedLabel} · Sync
            </a>
          )}
          <div className="mt-4 flex gap-6 border-t border-white/10 pt-3.5">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/50">Protected</p>
              <p className="text-sm font-semibold text-white/80">{formatUSD(result.emergencyBuffer)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/50">Committed</p>
              <p className="text-sm font-semibold text-amber-300">{formatUSD(result.billsDueSoon)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/50">Liquid</p>
              <p className="text-sm font-semibold text-white/80">{formatUSD(result.liquidTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Monthly Expenses", value: formatUSD(monthlyBillsTotal), color: "text-red-400" },
          { label: "Subscriptions", value: formatUSD(monthlySubsTotal), color: "text-amber-400" },
          { label: "Active Goals", value: String(goals.length), color: "text-[var(--text-1)]" },
          { label: "Spent This Month", value: formatUSD(totalSpentMonth), color: "text-[var(--text-3)]" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">{stat.label}</p>
            <p className={`mt-1 text-xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 5. Recent activity — visible without scrolling */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Recent Activity</h2>
            <p className="text-[10px] text-[var(--text-3)] mt-0.5">Last 7 days</p>
          </div>
          <a href="/transactions" className="text-xs text-purple-400 transition-colors hover:text-purple-300">See all</a>
        </div>
        {recentTx.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center">
            <p className="text-sm text-[var(--text-3)]">No activity yet — sync your bank or add a transaction manually.</p>
            <a href="/transactions" className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300">Go to Activity →</a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
            {recentTx.map((tx) => {
              const isIncome = Number(tx.amount) > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${isIncome ? "bg-green-500/15 text-green-500" : "bg-[var(--bg-elevated)] text-[var(--text-3)]"}`}>
                      {isIncome ? "+" : tx.category?.slice(0, 1).toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-1)] truncate">{tx.merchant ?? (isIncome ? "Income" : "Transaction")}</p>
                      <p className="text-xs text-[var(--text-3)] mt-0.5">{formatDate(tx.date)}{tx.category ? ` · ${tx.category}` : ""}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${isIncome ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"}`}>
                    {isIncome ? "+" : ""}{formatUSDCents(Math.abs(Number(tx.amount)))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Expenses this week */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Expenses This Week</h2>
          <a href="/bills" className="text-xs text-purple-400 transition-colors hover:text-purple-300">See all</a>
        </div>
        {upcomingBills.length === 0 && (upcomingExpensesWeekResult.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center">
            <p className="text-sm text-[var(--text-3)]">Nothing due soon. You&apos;re ahead of it.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
            {upcomingBills.map((bill) => {
              const isOverdue = bill.next_due_date < today;
              const isDueSoon = !isOverdue && bill.next_due_date <= in3Days;
              return (
                <div key={bill.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : "text-[var(--text-1)]"}`}>{bill.name}</p>
                    <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500" : isDueSoon ? "text-amber-400" : "text-[var(--text-3)]"}`}>
                      {formatDate(bill.next_due_date)}
                      {bill.is_autopay && <span className="ml-2 text-[var(--text-3)]">Autopay</span>}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${isOverdue ? "text-red-400" : "text-[var(--text-1)]"}`}>
                    {formatUSDCents(Number(bill.amount))}
                  </span>
                </div>
              );
            })}
            {(upcomingExpensesWeekResult.data ?? []).map((exp) => {
              const diff = Math.ceil((new Date(exp.expense_date + "T00:00:00").getTime() - Date.now()) / 86400000);
              const isClose = diff <= 3;
              return (
                <div key={exp.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-1)]">{exp.name}</p>
                    <p className={`text-xs mt-0.5 ${isClose ? "text-amber-400" : "text-[var(--text-3)]"}`}>
                      {formatDate(exp.expense_date)} · one-time
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{formatUSDCents(Number(exp.amount))}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 7. Goals */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Goals</h2>
          <a href="/goals" className="text-xs text-purple-400 transition-colors hover:text-purple-300">See all</a>
        </div>
        {goals.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center">
            <p className="text-sm text-[var(--text-3)]">No goals yet. Where do you want to go?</p>
            <a href="/goals" className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300">Add a goal →</a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
            {goals.slice(0, 3).map((goal) => {
              const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
              const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000) : null;
              const onTrack = daysLeft === null || daysLeft > 14;
              return (
                <div key={goal.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--text-1)]">{goal.name}</p>
                    <div className="flex items-center gap-2">
                      {daysLeft !== null && daysLeft <= 30 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${onTrack ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"}`}>
                          {daysLeft <= 0 ? "Deadline passed" : `${daysLeft}d left`}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-3)]">{pct}%</span>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-3)]">
                    {formatUSD(goal.current_amount)} of {formatUSD(goal.target_amount)}
                  </p>
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-purple-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {settingsResult.data?.last_plan_review && (
        <p className="text-center text-[10px] text-[var(--text-3)]">
          Plan last reviewed: {new Date(settingsResult.data.last_plan_review).toLocaleDateString("en-US", { month: "short", day: "numeric" })} by Kairos
        </p>
      )}
    </div>
  );
}

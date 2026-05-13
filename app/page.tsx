import { Metadata } from "next";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatUSDCents, formatDate } from "@/lib/format";
import Link from "next/link";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { LukaDailyInsight } from "@/components/dashboard/LukaDailyInsight";
import { CalendarOptInCard } from "@/components/dashboard/CalendarOptInCard";
import { CalendarCard } from "@/components/dashboard/CalendarCard";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { ConnectBankCard } from "@/components/dashboard/ConnectBankCard";
import { DashboardSyncButton } from "@/components/dashboard/DashboardSyncButton";
import { generateInsightIfNeeded } from "@/lib/daily-insight";

export const dynamic = "force-dynamic";

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
    insight,
    goalsResult,
    settingsResult,
    upcomingBillsResult,
    allBillsResult,
    subsResult,
    spendingRes,
    upcomingExpensesWeekResult,
    upcomingExpensesMonthResult,
    recentTxResult,
    lastSyncedResult,
    accountsCheckResult,
    calendarConnResult,
  ] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    generateInsightIfNeeded(supabase, user.id).catch(() => null),
    supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", user.id).order("priority", { ascending: true }),
    supabase.from("user_settings").select("display_name, last_plan_review").eq("user_id", user.id).maybeSingle(),
    supabase.from("bills").select("id, name, amount, next_due_date, is_autopay").eq("user_id", user.id).not("next_due_date", "is", null).gte("next_due_date", today).lte("next_due_date", sevenDaysOut).order("next_due_date", { ascending: true }),
    supabase.from("bills").select("name, amount, frequency, next_due_date").eq("user_id", user.id).is("paid_at", null),
    supabase.from("bills").select("amount, subscription_status").eq("user_id", user.id).eq("is_subscription", true).is("paid_at", null),
    supabase.from("transactions").select("amount").eq("user_id", user.id).lt("amount", 0).gte("date", monthStart),
    supabase.from("upcoming_expenses").select("id, name, amount, expense_date").eq("user_id", user.id).eq("is_paid", false).gte("expense_date", today).lte("expense_date", sevenDaysOut).order("expense_date", { ascending: true }),
    supabase.from("upcoming_expenses").select("amount").eq("user_id", user.id).eq("is_paid", false).gte("expense_date", monthStart),
    supabase.from("transactions").select("id, merchant, amount, date, category").eq("user_id", user.id).gte("date", sevenDaysAgo).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
    supabase.from("accounts").select("last_synced").eq("user_id", user.id).not("last_synced", "is", null).order("last_synced", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
    supabase.from("calendar_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const calendarConnected = !!calendarConnResult.data;

  const goals = goalsResult.data ?? [];
  const displayName = (settingsResult.data?.display_name ?? "there").trim();
  const upcomingBills = upcomingBillsResult.data ?? [];

  const monthlyRecurringTotal = (allBillsResult.data ?? []).reduce((s, b) => s + toMonthly(Number(b.amount), b.frequency), 0);
  const monthlyUpcomingTotal = (upcomingExpensesMonthResult.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const monthlyBillsTotal = monthlyRecurringTotal + monthlyUpcomingTotal;
  const totalSpentMonth = (spendingRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const monthlySubsTotal = (subsResult.data ?? []).filter((s) => s.subscription_status === "keep" || s.subscription_status == null).reduce((s, sub) => s + Number(sub.amount), 0);

  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const recentTx = recentTxResult.data ?? [];
  const lastSynced = lastSyncedResult.data?.last_synced ?? null;
  const hasAccounts = (accountsCheckResult.data?.length ?? 0) > 0;
  const isNewUser = !!user.created_at && (Date.now() - new Date(user.created_at).getTime()) < 7 * 86_400_000;
  // Pass raw timestamp to DashboardSyncButton — formatting happens client-side so it stays live

  return (
    <div className="overflow-x-hidden space-y-8 px-4 pb-10 pt-5 md:space-y-8 md:px-8 md:pt-8">

      {/* 1. Greeting + date */}
      <GreetingHeader displayName={displayName} />

      {/* Welcome banner — first 7 days only */}
      {isNewUser && !hasAccounts && (
        <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/8 px-4 py-3 text-sm text-[var(--text-2)]">
          Welcome to Steward, {displayName}! Connect your bank below to unlock your full financial picture.
        </div>
      )}


      {/* 2. Luka daily insight */}
      <LukaDailyInsight insight={insight} />

      {/* 3. Safe-to-spend hero — or connect bank nudge if no accounts */}
      {!hasAccounts ? (
        <ConnectBankCard />
      ) : (
      <Link href="/card" className="block">
      <div className="overflow-hidden rounded-2xl shadow-xl transition-opacity active:opacity-90" style={{ backgroundColor: "#0b1d3a" }}>
        <div style={{ height: 3, backgroundColor: "#2563eb", flexShrink: 0 }} />
        <div className="p-6">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Safe to Spend</p>
          <p className={`mt-2 text-6xl leading-none tracking-tight font-[family-name:var(--font-display)] ${result.safeToSpendRaw < 0 ? "text-red-400" : "text-white"}`}>
            {formatUSD(result.safeToSpend)}
          </p>
          <DashboardSyncButton serverLastSynced={lastSynced} />
          <div className="mt-4 flex gap-6 border-t pt-3.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40">Protected</p>
              {result.emergencyBuffer > 0 ? (
                <p className="text-sm font-semibold text-white/70">{formatUSD(result.emergencyBuffer)}</p>
              ) : (
                <a href="/settings" className="text-xs text-white/30 hover:text-white/50 transition-colors">Not set →</a>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40">Committed</p>
              <p className="text-sm font-semibold text-amber-300">{formatUSD(result.billsDueSoon)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40">Liquid</p>
              <p className="text-sm font-semibold text-blue-300">{formatUSD(result.liquidTotal)}</p>
            </div>
          </div>
          <p className="mt-3.5 text-[11px] italic text-white/20">Faithfulness with what&apos;s been entrusted.</p>
        </div>
      </div>
      </Link>
      )}

      {/* 3.5 Calendar (connected users) + opt-in (unconnected, env set) */}
      <CalendarCard initiallyConnected={calendarConnected} />
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <CalendarOptInCard initiallyConnected={calendarConnected} />}

      {/* 4. Stats strip — flat horizontal dividers, no card chrome */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-x divide-[var(--border)] flex">
        {[
          { label: "Bills", value: formatUSD(monthlyBillsTotal), color: "text-red-400", href: "/bills" },
          { label: "Subscriptions", value: formatUSD(monthlySubsTotal), color: "text-amber-400", href: "/bills" },
          { label: "Goals", value: String(goals.length), color: "text-[var(--text-1)]", href: "/goals" },
          { label: "Spent", value: formatUSD(totalSpentMonth), color: "text-[var(--text-2)]", href: "/transactions" },
        ].map((stat) => (
          <a
            key={stat.label}
            href={stat.href}
            className="flex-1 px-3 py-4 block transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
          >
            <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-3)]">{stat.label}</p>
            <p className={`mt-1 text-base font-semibold ${stat.color}`}>{stat.value}</p>
          </a>
        ))}
      </div>

      {/* 5–7. Swipeable dashboard tabs */}
      <DashboardTabs>
        {/* Recent activity */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Recent Activity</h2>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Last 7 days</p>
            </div>
            <a href="/transactions" className="text-xs text-blue-400 transition-colors hover:text-blue-300">See all</a>
          </div>
          {recentTx.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--text-3)]">No recent transactions.</p>
              <a href="/transactions" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">Sync or add one →</a>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
              {recentTx.map((tx) => {
                const isIncome = Number(tx.amount) > 0;
                return (
                  <a
                    key={tx.id}
                    href={tx.merchant ? `/merchant/${encodeURIComponent(tx.merchant)}` : "/transactions"}
                    className="flex items-center justify-between px-4 py-3.5 gap-3 transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isIncome ? "bg-emerald-500" : "bg-[var(--text-3)]"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-1)] truncate">{tx.merchant ?? (isIncome ? "Income" : "Transaction")}</p>
                        <p className="text-xs text-[var(--text-3)] mt-0.5">{formatDate(tx.date)}{tx.category ? ` · ${tx.category}` : ""}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${isIncome ? "text-emerald-500" : "text-[var(--text-2)]"}`}>
                      {isIncome ? "+" : "−"}{formatUSDCents(Math.abs(Number(tx.amount)))}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Expenses this week */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Coming Due</h2>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Bills + expenses in 7 days</p>
            </div>
            <a href="/bills" className="text-xs text-blue-400 transition-colors hover:text-blue-300">See all</a>
          </div>
          {upcomingBills.length === 0 && (upcomingExpensesWeekResult.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--text-3)]">Nothing due this week.</p>
              <p className="mt-1 text-xs text-[var(--text-3)] opacity-60">You&apos;re ahead of it.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
              {upcomingBills.map((bill) => {
                const isOverdue = bill.next_due_date < today;
                const isDueSoon = !isOverdue && bill.next_due_date <= in3Days;
                return (
                  <div key={bill.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isOverdue ? "bg-red-500" : isDueSoon ? "bg-amber-400" : "bg-[var(--text-3)]"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isOverdue ? "text-red-400" : "text-[var(--text-1)]"} truncate`}>{bill.name}</p>
                        <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500" : isDueSoon ? "text-amber-400" : "text-[var(--text-3)]"}`}>
                          {formatDate(bill.next_due_date)}
                          {bill.is_autopay && <span className="ml-2 opacity-60">· auto</span>}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${isOverdue ? "text-red-400" : "text-[var(--text-2)]"}`}>
                      {formatUSDCents(Number(bill.amount))}
                    </span>
                  </div>
                );
              })}
              {(upcomingExpensesWeekResult.data ?? []).map((exp) => {
                const diff = Math.ceil((new Date(exp.expense_date + "T00:00:00").getTime() - Date.now()) / 86400000);
                const isClose = diff <= 3;
                return (
                  <div key={exp.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isClose ? "bg-amber-400" : "bg-[var(--text-3)]"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-1)] truncate">{exp.name}</p>
                        <p className={`text-xs mt-0.5 ${isClose ? "text-amber-400" : "text-[var(--text-3)]"}`}>
                          {formatDate(exp.expense_date)} · one-time
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0 text-[var(--text-2)]">{formatUSDCents(Number(exp.amount))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Goals */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Goals</h2>
              <p className="text-[10px] text-[var(--text-3)] mt-0.5">Active targets</p>
            </div>
            <a href="/goals" className="text-xs text-blue-400 transition-colors hover:text-blue-300">See all</a>
          </div>
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--text-3)]">No goals set yet.</p>
              <a href="/goals" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">Set your first goal →</a>
            </div>
          ) : (
            <a href="/goals" className="block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] transition-all active:scale-[0.99] hover:border-[var(--border-strong)]">
              {goals.slice(0, 3).map((goal) => {
                const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
                const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000) : null;
                const onTrack = daysLeft === null || daysLeft > 14;
                return (
                  <div key={goal.id} className="px-4 py-5">
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
                        className={`h-1.5 rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </a>
          )}
        </section>

        {settingsResult.data?.last_plan_review && (
          <p className="text-center text-[10px] tracking-wide text-[var(--text-3)] opacity-60">
            Plan reviewed {new Date(settingsResult.data.last_plan_review).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Kairos
          </p>
        )}
      </DashboardTabs>
    </div>
  );
}

import { Metadata } from "next";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { createClient } from "@/lib/supabase/server";
import { formatUSD, formatDate } from "@/lib/format";
import { QuickActionRow } from "@/components/dashboard/QuickActionRow";
import { LukaMorningBriefing } from "@/components/dashboard/LukaMorningBriefing";
import { SolomonWord } from "@/components/dashboard/SolomonWord";
import { SilasInsights } from "@/components/dashboard/SilasInsights";
import { AllocationCard } from "@/components/dashboard/AllocationCard";
import { MannaCard } from "@/components/dashboard/MannaCard";
import { EdenMoment } from "@/components/dashboard/EdenMoment";
import { NovaMessage } from "@/components/dashboard/NovaMessage";

export const metadata: Metadata = {
  title: "Dashboard — Steward Money",
};

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h <= 11) return "Good morning";
  if (h >= 12 && h <= 16) return "Good afternoon";
  if (h >= 17 && h <= 20) return "Good evening";
  return "Hey";
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

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  await advanceStaleIncomeDates(supabase, user.id);

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [
    result,
    goalsResult,
    settingsResult,
    upcomingBillsResult,
    allBillsResult,
    subsResult,
    spendingRes,
    incomeTransactionsResult,
    alertsResult,
    solomonResult,
    silasResult,
  ] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", user.id).order("priority", { ascending: true }),
    supabase.from("user_settings").select("display_name, life_stage, main_goal, last_plan_review").eq("user_id", user.id).maybeSingle(),
    supabase.from("bills").select("id, name, amount, next_due_date, is_autopay").eq("user_id", user.id).not("next_due_date", "is", null).gte("next_due_date", today).lte("next_due_date", sevenDaysOut).order("next_due_date", { ascending: true }),
    supabase.from("bills").select("name, amount, frequency, next_due_date").eq("user_id", user.id),
    supabase.from("subscriptions").select("amount, status").eq("user_id", user.id),
    supabase.from("transactions").select("category, amount").eq("user_id", user.id).lt("amount", 0).gte("date", monthStart),
    supabase.from("transactions").select("amount").eq("user_id", user.id).gt("amount", 0).gte("date", monthStart),
    supabase.from("alerts").select("id, message, severity, alert_type").eq("user_id", user.id).eq("is_read", false).order("created_at", { ascending: false }).limit(4),
    supabase.from("weekly_reports").select("solomon_word, stewardship_score, week_start, lived_within_provision, giving_honored").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pulse_insights").select("id, insight_text, insight_type").eq("user_id", user.id).eq("is_active", true).eq("is_dismissed", false).order("confidence_score", { ascending: false }).limit(2),
  ]);

  const goals = goalsResult.data ?? [];
  const displayName = (settingsResult.data?.display_name ?? "there").trim();
  const upcomingBills = upcomingBillsResult.data ?? [];
  const alerts = alertsResult.data ?? [];

  const monthlyBillsTotal = (allBillsResult.data ?? []).reduce((s, b) => s + toMonthly(Number(b.amount), b.frequency), 0);
  const monthlyIncome = (incomeTransactionsResult.data ?? []).reduce((s, t) => s + Number(t.amount), 0);
  const totalSpentMonth = (spendingRes.data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const monthlySubsTotal = (subsResult.data ?? []).filter((s) => s.status === "keep").reduce((s, sub) => s + Number(sub.amount), 0);

  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const billsDueThisWeekList = upcomingBills.map((b) => ({ name: b.name, amount: Number(b.amount) }));

  const formattedDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const briefingData = {
    safeToSpend: result.safeToSpend,
    liquidTotal: result.liquidTotal,
    billsDueSoon: result.billsDueSoon,
    nextIncomeDate: result.nextIncomeDate,
    displayName,
    alertCount: alerts.length,
    billsDueThisWeek: billsDueThisWeekList,
  };

  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:space-y-6 md:px-8 md:pt-8">

      {/* 1. Greeting + date */}
      <header>
        <h1 className="text-2xl font-semibold text-[var(--text-1)]">
          {getGreeting()}, {displayName}.
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-3)]">{formattedDate}</p>
      </header>

      {/* 2. Manna — daily bread */}
      <MannaCard />

      {/* 3. Luka morning briefing */}
      <LukaMorningBriefing data={briefingData} />

      {/* 4. Eden — vision & gratitude */}
      <EdenMoment />

      {/* 5. Nova — forward-looking messages */}
      <NovaMessage />

      {/* 6. Solomon's word */}
      {solomonResult.data && <SolomonWord report={solomonResult.data} />}

      {/* 7. Argus alerts */}
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
        </div>
      )}

      {/* 8. Safe-to-spend hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3d1f7d] via-[#4a1d96] to-[#2a1f6e] p-6 shadow-2xl shadow-purple-900/40">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-4 h-28 w-52 rounded-full bg-purple-400/10 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Safe to Spend</p>
          <p className={`mt-1.5 text-5xl font-bold leading-none tracking-tight ${result.safeToSpendRaw < 0 ? "text-red-400" : "text-white"}`}>
            {formatUSD(result.safeToSpend)}
          </p>
          <p className="mt-1.5 text-xs text-white/40">After bills, buffer &amp; deductions</p>
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

      {/* 9. Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Monthly Bills", value: formatUSD(monthlyBillsTotal), color: "text-red-400" },
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

      {/* 10. Allocation card */}
      {result.nextIncomeAmount > 0 && (
        <AllocationCard income={result.nextIncomeAmount} />
      )}

      {/* 11. Silas sees */}
      <SilasInsights insights={silasResult.data ?? []} />

      {/* 12. Bills due this week */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Bills This Week</h2>
          <a href="/bills" className="text-xs text-purple-400 transition-colors hover:text-purple-300">See all</a>
        </div>
        {upcomingBills.length === 0 ? (
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
                    {formatUSD(Number(bill.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 13. Goals */}
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

      {/* 14. Quick actions — includes Council */}
      <QuickActionRow />

      {/* Footer — last reviewed */}
      {settingsResult.data?.last_plan_review && (
        <p className="text-center text-[10px] text-[var(--text-3)]">
          Plan last reviewed: {new Date(settingsResult.data.last_plan_review).toLocaleDateString("en-US", { month: "short", day: "numeric" })} by Kairos
        </p>
      )}
    </div>
  );
}

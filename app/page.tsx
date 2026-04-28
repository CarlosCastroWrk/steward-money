import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { createClient } from "@/lib/supabase/server";
import { QuickActionRow } from "@/components/dashboard/QuickActionRow";
import { MonthlyOverview } from "@/components/dashboard/MonthlyOverview";
import { BillsDueSoonSection } from "@/components/dashboard/BillsDueSoonSection";

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return "Good morning";
  if (hour >= 12 && hour <= 16) return "Good afternoon";
  if (hour >= 17 && hour <= 20) return "Good evening";
  return "Hey";
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

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  await advanceStaleIncomeDates(supabase, user.id);

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysStr = sevenDaysOut.toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [
    result,
    goalsResult,
    settingsResult,
    upcomingBillsResult,
    allBillsResult,
    subsResult,
    spendingRes,
    incomeRes,
    incomeTransactionsResult,
  ] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, deadline")
      .eq("user_id", user.id)
      .order("priority", { ascending: true }),
    supabase
      .from("user_settings")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bills")
      .select("id, name, amount, next_due_date, is_autopay")
      .eq("user_id", user.id)
      .not("next_due_date", "is", null)
      .gte("next_due_date", today)
      .lte("next_due_date", sevenDaysStr)
      .order("next_due_date", { ascending: true }),
    supabase.from("bills").select("name, amount, frequency, next_due_date, is_autopay").eq("user_id", user.id),
    supabase.from("subscriptions").select("amount, status").eq("user_id", user.id),
    supabase
      .from("transactions")
      .select("category, amount")
      .eq("user_id", user.id)
      .lt("amount", 0)
      .gte("date", monthStart),
    supabase.from("income_sources").select("name, next_date").eq("user_id", user.id).eq("is_active", true),
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .gt("amount", 0)
      .gte("date", monthStart),
  ]);

  const goals = goalsResult.data ?? [];
  const displayName = (settingsResult.data?.display_name ?? "there").trim();
  const upcomingBills = upcomingBillsResult.data ?? [];

  const monthlyBillsTotal = (allBillsResult.data ?? []).reduce(
    (s, b) => s + toMonthly(Number(b.amount), b.frequency),
    0
  );
  const monthlyIncome = (incomeTransactionsResult.data ?? []).reduce(
    (s, t) => s + Number(t.amount),
    0
  );

  const categoryMap = new Map<string, number>();
  for (const tx of spendingRes.data ?? []) {
    const key = tx.category ?? "Other";
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + Math.abs(Number(tx.amount)));
  }
  const totalSpentMonth = [...categoryMap.values()].reduce((s, v) => s + v, 0);

  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().split("T")[0];

  const allAlerts: Array<{ message: string; severity: "info" | "warning" | "danger"; priority: number }> = [];

  if (result.safeToSpendRaw < 0) {
    allAlerts.push({ message: "Safe-to-spend is negative. Review your bills before spending.", severity: "danger", priority: 0 });
  }
  if (result.safeToSpendRaw >= 0 && result.liquidTotal > 0 && result.safeToSpend < result.emergencyBuffer * 0.5) {
    allAlerts.push({ message: "Your cushion is thin — below 50% of your emergency reserve.", severity: "warning", priority: 1 });
  }
  if (result.liquidTotal > 0 && result.billsDueSoon > result.liquidTotal * 0.6) {
    allAlerts.push({ message: "Over 60% of your liquid cash is committed to upcoming bills.", severity: "warning", priority: 2 });
  }
  for (const b of allBillsResult.data ?? []) {
    if (b.next_due_date && b.next_due_date < today && b.next_due_date >= fourteenDaysAgo) {
      allAlerts.push({ message: `${b.name} is overdue.`, severity: "danger", priority: 3 });
      break;
    }
  }
  for (const b of allBillsResult.data ?? []) {
    if (b.next_due_date && !b.is_autopay && b.next_due_date >= today && b.next_due_date <= in3Days) {
      allAlerts.push({ message: `${b.name} ($${Number(b.amount).toFixed(0)}) is due within 3 days.`, severity: "warning", priority: 4 });
      break;
    }
  }
  for (const inc of incomeRes.data ?? []) {
    if (inc.next_date && inc.next_date < today) {
      allAlerts.push({ message: `"${inc.name}" income is past due — mark it received.`, severity: "info", priority: 5 });
      break;
    }
  }

  const alerts = allAlerts.sort((a, b) => a.priority - b.priority).slice(0, 3);

  const nextPaycheck = result.nextIncomeDate
    ? new Date(result.nextIncomeDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not set";

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:space-y-6 md:px-8 md:pt-8">

      {/* Greeting */}
      <header>
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {displayName}.
        </h1>
        <p className="mt-0.5 text-sm text-[#9898a8]">{formattedDate}</p>
      </header>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 text-sm ${
                alert.severity === "danger"
                  ? "border-red-900/50 bg-red-950/40 text-red-300"
                  : alert.severity === "info"
                  ? "border-zinc-700/40 bg-zinc-800/30 text-zinc-400"
                  : "border-amber-900/50 bg-amber-950/40 text-amber-300"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Today's Brief */}
      <div className="rounded-2xl border border-[#ffffff08] bg-[#13131f] px-4 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9898a8]">
          Today&apos;s Brief
        </p>
        <div className="flex items-center divide-x divide-[#ffffff08]">
          <div className="flex-1 pr-4">
            <p className="text-[10px] uppercase tracking-wide text-[#9898a8]">Liquid Cash</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{formatUSD(result.liquidTotal)}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[10px] uppercase tracking-wide text-[#9898a8]">Due Soon</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-400">{formatUSD(result.billsDueSoon)}</p>
          </div>
          <div className="flex-1 pl-4">
            <p className="text-[10px] uppercase tracking-wide text-[#9898a8]">Paycheck</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{nextPaycheck}</p>
          </div>
        </div>
      </div>

      {/* Safe to Spend Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3d1f7d] via-[#4a1d96] to-[#2a1f6e] p-6 shadow-2xl shadow-purple-900/40">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-4 h-28 w-52 rounded-full bg-purple-400/10 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/60">Safe to Spend</p>
          <p className="mt-1.5 text-5xl font-bold leading-none tracking-tight text-white">
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

      {/* Quick Actions */}
      <QuickActionRow />

      {/* Monthly Overview */}
      <MonthlyOverview income={monthlyIncome} expenses={totalSpentMonth} bills={monthlyBillsTotal} />

      {/* Bills Due Soon */}
      <BillsDueSoonSection bills={upcomingBills} />

      {/* Goals */}
      {goals.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#9898a8]">Goals</h2>
            <a href="/goals" className="text-xs text-emerald-400 transition-colors hover:text-emerald-300">
              See all
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#ffffff08] bg-[#13131f] divide-y divide-[#ffffff04]">
            {goals.slice(0, 3).map((goal) => {
              const pct =
                goal.target_amount > 0
                  ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                  : 0;
              return (
                <div key={goal.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-100">{goal.name}</p>
                    <span className="text-xs text-[#9898a8]">{pct}%</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#9898a8]">
                    {formatUSD(goal.current_amount)} of {formatUSD(goal.target_amount)}
                  </p>
                  <div className="mt-2.5 h-1 w-full rounded-full bg-[#1a1a28]">
                    <div className="h-1 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

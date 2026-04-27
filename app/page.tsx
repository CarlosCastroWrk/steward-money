import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { createClient } from "@/lib/supabase/server";

function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
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

function relativeDue(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

function billUrgencyClass(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff <= 1) return "text-red-400";
  if (diff <= 3) return "text-amber-400";
  return "text-zinc-400";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  await advanceStaleIncomeDates(supabase, user.id);

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysStr = sevenDaysOut.toISOString().split("T")[0];

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];

  const [result, goalsResult, settingsResult, upcomingBillsResult, allBillsResult, subsResult, spendingRes, incomeRes] =
    await Promise.all([
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
      // Bills due in the next 7 days (for dashboard widget)
      supabase
        .from("bills")
        .select("id, name, amount, next_due_date, is_autopay")
        .eq("user_id", user.id)
        .not("next_due_date", "is", null)
        .gte("next_due_date", today)
        .lte("next_due_date", sevenDaysStr)
        .order("next_due_date", { ascending: true }),
      // All bills (for monthly total + alerts)
      supabase.from("bills").select("name, amount, frequency, next_due_date, is_autopay").eq("user_id", user.id),
      supabase.from("subscriptions").select("amount, status").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", user.id)
        .lt("amount", 0)
        .gte("date", monthStart),
      supabase.from("income_sources").select("name, next_date").eq("user_id", user.id).eq("is_active", true),
    ]);

  const goals = goalsResult.data ?? [];
  const displayName = (settingsResult.data?.display_name ?? "there").trim();
  const upcomingBills = upcomingBillsResult.data ?? [];

  const monthlyBillsTotal = (allBillsResult.data ?? []).reduce(
    (s, b) => s + toMonthly(Number(b.amount), b.frequency),
    0
  );
  const monthlySubsTotal = (subsResult.data ?? []).reduce(
    (s, sub) => s + Number(sub.amount),
    0
  );
  const subsData = subsResult.data ?? [];
  const keepingCount = subsData.filter((s) => s.status === "keep").length;
  const reviewingCount = subsData.filter((s) => s.status !== "keep").length;

  // Spending by category this month
  const categoryMap = new Map<string, number>();
  for (const tx of spendingRes.data ?? []) {
    const key = tx.category ?? "Other";
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + Math.abs(Number(tx.amount)));
  }
  const categoryTotals = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalSpentMonth = [...categoryMap.values()].reduce((s, v) => s + v, 0);

  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString().split("T")[0];
  const alerts: Array<{ message: string; severity: "info" | "warning" | "danger" }> = [];

  for (const b of allBillsResult.data ?? []) {
    if (b.next_due_date && b.next_due_date < today) {
      alerts.push({ message: `${b.name} is overdue`, severity: "danger" });
    } else if (b.next_due_date && !b.is_autopay && b.next_due_date >= today && b.next_due_date <= in3Days) {
      alerts.push({ message: `${b.name} ($${Number(b.amount).toFixed(0)}) is due in the next 3 days`, severity: "warning" });
    }
  }
  if (result.safeToSpendRaw < 0) {
    alerts.push({ message: "Your safe-to-spend is negative. Review your bills before spending.", severity: "danger" });
  } else if (result.liquidTotal > 0 && result.safeToSpend < result.emergencyBuffer * 0.5) {
    alerts.push({ message: "Your cushion is thin right now. Spend carefully.", severity: "warning" });
  }
  for (const g of goalsResult.data ?? []) {
    if (!g.deadline) continue;
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
    if (g.deadline <= in60Days && pct < 50) {
      alerts.push({ message: `"${g.name}" goal is ${Math.round(pct)}% funded — deadline approaching`, severity: "warning" });
    }
  }
  for (const inc of incomeRes.data ?? []) {
    if (inc.next_date && inc.next_date < today) {
      alerts.push({ message: `"${inc.name}" income is past due — mark it received`, severity: "info" });
    }
  }

  const nextPaycheck = result.nextIncomeDate
    ? new Date(result.nextIncomeDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    : "Not set";

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-8">
      <header>
        <h1 className="text-2xl font-medium text-white">
          {getGreeting()}, {displayName}.
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
          })}
        </p>
      </header>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Add transaction", href: "/transactions" },
          { label: "Add bill", href: "/bills" },
          { label: "Add goal", href: "/goals" },
          { label: "Accounts", href: "/accounts" },
        ].map((action) => (
          <a
            key={action.href}
            href={action.href}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            {action.label}
          </a>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                alert.severity === "danger"
                  ? "border-red-900 bg-red-950/60 text-red-200"
                  : alert.severity === "info"
                  ? "border-zinc-700 bg-zinc-800/60 text-zinc-300"
                  : "border-amber-900 bg-amber-950/60 text-amber-200"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Safe-to-spend hero */}
      <div className="rounded-xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-5 shadow-lg shadow-purple-900/30 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Safe to spend</p>
            <p className="text-4xl font-bold text-white">{formatUSD(result.safeToSpend)}</p>
            <p className="mt-1 text-xs text-white/60">After all deductions</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-white/60">Liquid cash</p>
            <p className="text-base font-semibold text-white/90 md:text-lg">{formatUSD(result.liquidTotal)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 border-t border-white/20 pt-3 md:hidden">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Protected</p>
            <p className="text-sm font-semibold text-white/90">{formatUSD(result.emergencyBuffer)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Paycheck</p>
            <p className="text-sm font-semibold text-white">{nextPaycheck}</p>
          </div>
        </div>
        <div className="mt-3 hidden gap-8 border-t border-white/20 pt-3 text-right md:flex">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Protected</p>
            <p className="text-lg font-semibold text-white/90">{formatUSD(result.emergencyBuffer)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Paycheck</p>
            <p className="text-lg font-semibold text-white">{nextPaycheck}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Monthly bills</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{formatUSD(monthlyBillsTotal)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{allBillsResult.data?.length ?? 0} bills</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Subscriptions</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{formatUSD(monthlySubsTotal)}/mo</p>
          <p className="mt-0.5 text-xs text-zinc-500">{formatUSD(monthlySubsTotal * 12)}/yr</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active goals</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{goals.length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {goals.length === 0 ? "None set yet" : `${goals.length} in progress`}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sub decisions</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{keepingCount} keeping</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {reviewingCount > 0 ? `${reviewingCount} to review` : "All decided"}
          </p>

        </div>
      </div>

      {/* Bottom three-column grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Bills due in the next 7 days */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Bills due this week
          </h2>
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-zinc-500">No bills due in the next 7 days.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingBills.map((bill) => (
                <li key={bill.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-zinc-200">{bill.name}</p>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={billUrgencyClass(bill.next_due_date!)}>
                        {relativeDue(bill.next_due_date!)}
                      </span>
                      {bill.is_autopay && (
                        <span className="rounded-full bg-emerald-900/50 px-1.5 py-0.5 text-xs text-emerald-400">
                          auto
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-medium text-zinc-100">{formatUSD(Number(bill.amount))}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Goals */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Goals
          </h2>
          {goals.length === 0 ? (
            <p className="text-sm text-zinc-500">No goals set yet.</p>
          ) : (
            <ul className="space-y-4">
              {goals.slice(0, 4).map((goal) => {
                const pct =
                  goal.target_amount > 0
                    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                    : 0;
                return (
                  <li key={goal.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-100">{goal.name}</p>
                      <span className="text-xs text-zinc-500">{pct}%</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatUSD(goal.current_amount)} of {formatUSD(goal.target_amount)}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {goals.length > 4 && (
                <p className="text-xs text-zinc-600">+{goals.length - 4} more goals</p>
              )}
            </ul>
          )}
        </div>

        {/* Spending this month */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-1 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Spending this month
          </h2>
          {categoryTotals.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No spending recorded yet this month.</p>
          ) : (
            <>
              <p className="mb-3 text-lg font-semibold text-zinc-100">{formatUSD(totalSpentMonth)}</p>
              <div className="space-y-2">
                {categoryTotals.map(([cat, total]) => {
                  const pct = totalSpentMonth > 0 ? Math.round((total / totalSpentMonth) * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-zinc-300">{cat}</span>
                        <span className="text-zinc-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800">
                        <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

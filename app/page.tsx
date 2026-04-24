import { calculateSafeToSpend } from "@/lib/safe-to-spend";
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

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [result, goalsResult, settingsResult] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", user.id),
    supabase.from("user_settings").select("display_name, currency").eq("user_id", user.id).maybeSingle()
  ]);

  const goals = goalsResult.data ?? [];
  const settings = settingsResult.data;
  const displayName = (settings?.display_name ?? "there").trim();

  const alerts: Array<{ message: string; severity: "danger" | "warning" | "info" }> = [];
  if (result.safeToSpendRaw < 0) {
    alerts.push({
      message:
        "Your safe-to-spend is negative. Review your bills before making any purchases.",
      severity: "danger"
    });
  }
  if (result.safeToSpend < result.emergencyBuffer) {
    alerts.push({
      message: "Your cushion is thin this week. Spend carefully.",
      severity: "warning"
    });
  }
  if (result.billsDueSoon > result.liquidTotal * 0.6) {
    alerts.push({
      message: "Over 60% of your cash is committed to upcoming bills.",
      severity: "warning"
    });
  }

  const nextPaycheck = result.nextIncomeDate
    ? new Date(result.nextIncomeDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      })
    : "Not set";

  return (
    <div className="space-y-6 p-8">
      <header className="flex items-start justify-between">
        <div>
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
        </div>
      </header>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, index) => (
            <div
              key={`${alert.message}-${index}`}
              className={`rounded-lg border p-3 text-sm ${
                alert.severity === "danger"
                  ? "border-red-900 bg-red-950/60 text-red-200"
                  : alert.severity === "warning"
                    ? "border-amber-900 bg-amber-950/60 text-amber-200"
                    : "border-blue-900 bg-blue-950/60 text-blue-200"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-xl bg-purple-700 p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Safe to spend</p>
          <p className="text-4xl font-bold text-white">{formatUSD(result.safeToSpend)}</p>
          <p className="mt-1 text-xs text-white/60">After all deductions</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Total cash</p>
            <p className="text-lg font-semibold text-white/90">{formatUSD(result.liquidTotal)}</p>
          </div>
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

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Bills before next paycheck
          </h2>
          {result.billsDueSoonList.length === 0 ? (
            <p className="text-sm text-zinc-500">No bills due before your next paycheck.</p>
          ) : (
            <ul className="space-y-3">
              {result.billsDueSoonList.map((bill) => (
                <li key={bill.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-zinc-200">{bill.name}</p>
                    <p className="text-xs text-zinc-500">{bill.nextDueDate}</p>
                  </div>
                  <p className="font-medium text-zinc-100">{formatUSD(bill.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Goals
          </h2>
          {goals.length === 0 ? (
            <p className="text-sm text-zinc-500">No goals set yet.</p>
          ) : (
            <ul className="space-y-4">
              {goals.map((goal) => {
                const pct =
                  goal.target_amount > 0
                    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                    : 0;
                return (
                  <li key={goal.id}>
                    <p className="text-sm font-medium text-zinc-100">{goal.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatUSD(goal.current_amount)} of {formatUSD(goal.target_amount)} ({pct}%)
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-zinc-800">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 border-b border-zinc-800 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Safe-to-spend breakdown
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-zinc-400">Liquid cash</span>
              <span className="font-medium text-emerald-400">+{formatUSD(result.liquidTotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Bills due soon</span>
              <span className="text-zinc-300">-{formatUSD(result.billsDueSoon)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Emergency reserve</span>
              <span className="text-zinc-300">-{formatUSD(result.emergencyBuffer)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Weekly needs</span>
              <span className="text-zinc-300">-{formatUSD(result.weeklyNeedsTotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Giving</span>
              <span className="text-zinc-300">
                {result.givingDeducted === 0 ? "—" : `-${formatUSD(result.givingDeducted)}`}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Savings</span>
              <span className="text-zinc-300">
                {result.savingsDeducted === 0 ? "—" : `-${formatUSD(result.savingsDeducted)}`}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-zinc-400">Trading</span>
              <span className="text-zinc-300">
                {result.tradingDeducted === 0 ? "—" : `-${formatUSD(result.tradingDeducted)}`}
              </span>
            </li>
          </ul>
          <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 text-sm font-semibold">
            <span className="text-zinc-200">Safe to spend</span>
            <span className="text-purple-300">{formatUSD(result.safeToSpend)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

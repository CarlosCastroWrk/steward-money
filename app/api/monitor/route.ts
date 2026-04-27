import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type AlertInput = { type: string; message: string; severity: "info" | "warning" | "danger" };

async function computeAlerts(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<AlertInput[]> {
  const today = new Date().toISOString().split("T")[0];
  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString().split("T")[0];

  const [billsRes, goalsRes, incomeRes, safeRes] = await Promise.all([
    supabase.from("bills").select("name, amount, next_due_date, is_autopay").eq("user_id", userId),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
    supabase.from("income_sources").select("name, next_date").eq("user_id", userId).eq("is_active", true),
    calculateSafeToSpend(supabase, userId),
  ]);

  const alerts: AlertInput[] = [];

  // Overdue bills
  for (const b of billsRes.data ?? []) {
    if (b.next_due_date && b.next_due_date < today) {
      alerts.push({ type: "overdue_bill", message: `${b.name} (${fmt(b.amount)}) is overdue`, severity: "danger" });
    }
  }

  // Bills due within 3 days (manual pay only)
  for (const b of billsRes.data ?? []) {
    if (b.next_due_date && !b.is_autopay && b.next_due_date >= today && b.next_due_date <= in3Days) {
      alerts.push({ type: "bill_due_soon", message: `${b.name} (${fmt(b.amount)}) is due in the next 3 days`, severity: "warning" });
    }
  }

  // Low safe-to-spend
  if (safeRes.liquidTotal > 0 && safeRes.safeToSpend < safeRes.emergencyBuffer * 0.5) {
    alerts.push({ type: "low_balance", message: `Safe to spend is ${fmt(safeRes.safeToSpend)} — below half your emergency reserve`, severity: "warning" });
  }
  if (safeRes.safeToSpendRaw < 0) {
    alerts.push({ type: "negative_balance", message: `Safe to spend is negative (${fmt(safeRes.safeToSpend)}). Review bills before spending`, severity: "danger" });
  }

  // Goals falling behind
  for (const g of goalsRes.data ?? []) {
    if (!g.deadline) continue;
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
    if (g.deadline <= in60Days && pct < 50) {
      alerts.push({ type: "goal_behind", message: `"${g.name}" goal is ${Math.round(pct)}% funded with the deadline approaching`, severity: "warning" });
    }
  }

  // Stale income dates
  for (const inc of incomeRes.data ?? []) {
    if (inc.next_date && inc.next_date < today) {
      alerts.push({ type: "stale_income", message: `Income source "${inc.name}" has a past date — mark it received`, severity: "info" });
    }
  }

  return alerts;
}

// Called from dashboard (authenticated) OR from Vercel cron (uses admin client)
export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    // Cron path: refresh alerts for all users using admin client
    const admin = createAdminClient();
    const { data: users } = await admin.from("income_sources").select("user_id").limit(500);
    const uniqueUsers = [...new Set((users ?? []).map((u) => u.user_id))];

    for (const userId of uniqueUsers) {
      const alerts = await computeAlerts(admin as ReturnType<typeof createClient>, userId);
      await admin.from("alerts").delete().eq("user_id", userId);
      if (alerts.length > 0) {
        await admin.from("alerts").insert(alerts.map((a) => ({ ...a, user_id: userId })));
      }
    }
    return NextResponse.json({ ok: true, users: uniqueUsers.length });
  }

  // Auth path: refresh for current user
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await computeAlerts(supabase, user.id);
  await supabase.from("alerts").delete().eq("user_id", user.id);
  if (alerts.length > 0) {
    await supabase.from("alerts").insert(alerts.map((a) => ({ ...a, user_id: user.id })));
  }

  return NextResponse.json({ ok: true, count: alerts.length });
}

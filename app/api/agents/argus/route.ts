import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceStaleIncomeDates } from "@/lib/income";
import { saveAgentMemory } from "@/lib/agent-memory";

type AlertInput = {
  user_id: string;
  type: string;
  message: string;
  severity: "info" | "warning" | "danger";
  alert_type: string;
  agent: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function runArgus(supabase: ReturnType<typeof createClient>, userId: string): Promise<AlertInput[]> {
  const today = new Date().toISOString().split("T")[0];
  const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [billsRes, goalsRes, incomeRes, safeRes, settingsRes, givingTxRes] = await Promise.all([
    supabase.from("bills").select("name, amount, next_due_date, is_autopay").eq("user_id", userId),
    supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
    supabase.from("income_sources").select("name, next_date, next_expected_date").eq("user_id", userId).eq("is_active", true),
    calculateSafeToSpend(supabase, userId),
    supabase.from("user_settings").select("giving_enabled, giving_value, kairos_pending").eq("user_id", userId).maybeSingle(),
    supabase.from("transactions").select("amount, category").eq("user_id", userId).gt("amount", 0).gte("date", monthStart),
  ]);

  // Auto-advance stale income dates silently
  await advanceStaleIncomeDates(supabase, userId);

  const alerts: AlertInput[] = [];

  // Check 1 — Overdue expenses
  for (const b of billsRes.data ?? []) {
    if (b.next_due_date && b.next_due_date < today) {
      alerts.push({ user_id: userId, type: "overdue_bill", alert_type: "overdue_bill", message: `${b.name} is overdue — ${fmt(b.amount)}`, severity: "danger", agent: "argus" });
    }
  }

  // Check 2 — Expenses due within 3 days
  for (const b of billsRes.data ?? []) {
    if (b.next_due_date && !b.is_autopay && b.next_due_date >= today && b.next_due_date <= in3Days) {
      const daysLeft = Math.ceil((new Date(b.next_due_date).getTime() - Date.now()) / 86_400_000);
      const label = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
      alerts.push({ user_id: userId, type: "bill_due_soon", alert_type: "bill_due_soon", message: `${b.name} due ${label} — ${fmt(b.amount)}`, severity: "warning", agent: "argus" });
    }
  }

  // Check 3 — Safe-to-spend negative
  if (safeRes.safeToSpendRaw < 0) {
    alerts.push({ user_id: userId, type: "negative_balance", alert_type: "negative_balance", message: "Safe-to-spend is negative. Review before any purchases.", severity: "danger", agent: "argus" });
  }

  // Check 5 — Buffer breach warning
  const billsDueThisWeek = (billsRes.data ?? [])
    .filter((b) => b.next_due_date && b.next_due_date >= today && b.next_due_date <= in3Days)
    .reduce((s, b) => s + Number(b.amount), 0);
  if (safeRes.liquidTotal - billsDueThisWeek < safeRes.emergencyBuffer * 1.2 && safeRes.liquidTotal > 0) {
    alerts.push({ user_id: userId, type: "buffer_breach", alert_type: "buffer_breach", message: "Cash is approaching your protected buffer. Spend carefully this week.", severity: "warning", agent: "argus" });
  }

  // Check 6 — Goal falling behind
  for (const g of goalsRes.data ?? []) {
    if (!g.deadline) continue;
    const daysLeft = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86_400_000);
    if (daysLeft <= 0 || daysLeft > 90) continue;
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) : 0;
    const expectedPct = 1 - (daysLeft / 90);
    if (pct < expectedPct - 0.14) {
      alerts.push({ user_id: userId, type: "goal_behind", alert_type: "goal_behind", message: `${g.name} is falling behind schedule.`, severity: "info", agent: "argus" });
    }
  }

  // Check 7 — Giving not honored
  const settings = settingsRes.data;
  if (settings?.giving_enabled) {
    const givingThisMonth = (givingTxRes.data ?? []).some((tx) =>
      (tx.category ?? "").toLowerCase().includes("giving") ||
      (tx.category ?? "").toLowerCase().includes("tithe") ||
      (tx.category ?? "").toLowerCase().includes("donation")
    );
    if (!givingThisMonth) {
      alerts.push({ user_id: userId, type: "giving_not_honored", alert_type: "giving_not_honored", message: "No giving recorded this month yet.", severity: "info", agent: "argus" });
    }
  }

  // Deduplicate: only keep first of each alert_type
  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.alert_type)) return false;
    seen.add(a.alert_type);
    return true;
  }).slice(0, 4);
}

export async function POST(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (isCron) {
    const admin = createAdminClient();
    const { data: users } = await admin.from("income_sources").select("user_id").limit(500);
    const uniqueUsers = [...new Set((users ?? []).map((u: { user_id: string }) => u.user_id))];
    for (const userId of uniqueUsers) {
      const alerts = await runArgus(admin as ReturnType<typeof createClient>, userId);
      const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
      await admin.from("alerts").delete().eq("user_id", userId).eq("agent", "argus").lt("created_at", oneDayAgo);
      if (alerts.length > 0) {
        for (const alert of alerts) {
          const { data: existing } = await admin.from("alerts").select("id").eq("user_id", userId).eq("alert_type", alert.alert_type).gte("created_at", oneDayAgo).maybeSingle();
          if (!existing) await admin.from("alerts").insert(alert);
        }
      }
    }
    return NextResponse.json({ ok: true, users: uniqueUsers.length });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await runArgus(supabase, user.id);
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();

  await supabase.from("alerts").delete().eq("user_id", user.id).eq("agent", "argus").lt("created_at", oneDayAgo);

  const inserted = [];
  for (const alert of alerts) {
    const { data: existing } = await supabase.from("alerts").select("id").eq("user_id", user.id).eq("alert_type", alert.alert_type).gte("created_at", oneDayAgo).maybeSingle();
    if (!existing) {
      const { data } = await supabase.from("alerts").insert(alert).select().single();
      if (data) inserted.push(data);
    }
  }

  if (inserted.length > 0) {
    await saveAgentMemory(supabase, user.id, "argus",
      `Raised ${inserted.length} alert(s): ${inserted.map((a) => a.alert_type).join(", ")}`,
      inserted.some((a) => a.severity === "danger") ? 8 : 6
    );
  }

  return NextResponse.json({ ok: true, count: inserted.length, alerts: inserted });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

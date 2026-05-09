// TODO(post-pilot-1): extract executeTool() into lib/luka-tools/ per audit 2026-05-09. Defer until chat UI redesign or significant tool additions.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceIncomeDate } from "@/lib/income";
import { summarizeAgentMemoriesForLuka } from "@/lib/agent-memory";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIncompleteSetup } from "@/lib/progressive-setup";
import { getUpcomingEvents, formatCalendarContextForAgent } from "@/lib/calendar-context";
import { logAgentUsage } from "@/lib/agents/log-usage";
import {
  getRelevantMemories,
  searchMemories,
  saveMemory,
  updateMemory,
  deleteMemory,
  formatMemoriesForPrompt,
  MEMORY_TOOLS,
  MEMORY_SYSTEM_PROMPT_ADDITION,
} from "@/lib/memory";
import { AGENT_MEMORY_CATEGORIES } from "@/lib/agents/registry";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_financial_summary",
    description: "Get the user's current financial overview: account balances, safe-to-spend, upcoming expenses, active goals, income sources, recent transactions, Argus alerts, and latest Silas insight.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_spending_by_category",
    description: "Analyze the user's spending broken down by category over the last N days.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Days to look back (default 30)" } },
      required: [],
    },
  },
  {
    name: "get_goal_progress",
    description: "Get detailed progress for all savings goals.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_bill",
    description: "Create a new recurring expense. The tool automatically checks for existing bills with similar names and returns duplicate_found: true if a match exists — do not bypass this check by calling add_bill again.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number" },
        frequency: { type: "string", enum: ["monthly", "weekly", "biweekly", "quarterly", "yearly"] },
        next_due_date: { type: "string", description: "YYYY-MM-DD" },
        is_autopay: { type: "boolean" },
      },
      required: ["name", "amount", "frequency", "next_due_date"],
    },
  },
  {
    name: "update_bill",
    description: "Update an existing recurring expense. Use this when the user corrects or changes a bill that already exists — never duplicate it with add_bill.",
    input_schema: {
      type: "object",
      properties: {
        bill_name: { type: "string", description: "Existing bill name (partial match OK)" },
        amount: { type: "number" },
        frequency: { type: "string", enum: ["monthly", "weekly", "biweekly", "quarterly", "yearly"] },
        next_due_date: { type: "string", description: "YYYY-MM-DD" },
        is_autopay: { type: "boolean" },
      },
      required: ["bill_name"],
    },
  },
  {
    name: "add_goal",
    description: "Create a new savings goal.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        target_amount: { type: "number" },
        current_amount: { type: "number", description: "Already saved (default 0)" },
        deadline: { type: "string", description: "YYYY-MM-DD (optional)" },
      },
      required: ["name", "target_amount"],
    },
  },
  {
    name: "add_transaction",
    description: "Log a manual transaction. Use negative amount for expenses, positive for income.",
    input_schema: {
      type: "object",
      properties: {
        merchant: { type: "string" },
        amount: { type: "number", description: "Negative = expense, positive = income" },
        date: { type: "string", description: "YYYY-MM-DD (default today)" },
        category: { type: "string" },
        notes: { type: "string" },
      },
      required: ["merchant", "amount"],
    },
  },
  {
    name: "add_income_source",
    description: "Add a new income source. For salaried/fixed income provide 'amount'. For hourly workers provide 'hourly_rate' and 'weekly_hours' instead — amount will be calculated automatically. 'next_expected_date' is when the next paycheck arrives (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number", description: "Fixed paycheck amount. Omit if hourly." },
        hourly_rate: { type: "number", description: "Hourly pay rate (for variable/hourly workers)" },
        weekly_hours: { type: "number", description: "Average hours per week (for hourly workers)" },
        frequency: { type: "string", enum: ["monthly", "biweekly", "weekly", "twice monthly", "quarterly", "yearly"] },
        next_expected_date: { type: "string", description: "Next payday date YYYY-MM-DD" },
      },
      required: ["name", "frequency", "next_expected_date"],
    },
  },
  {
    name: "mark_bill_paid",
    description: "Mark a recurring expense as paid and advance its next due date.",
    input_schema: {
      type: "object",
      properties: { bill_name: { type: "string", description: "Expense name (partial match OK)" } },
      required: ["bill_name"],
    },
  },
  {
    name: "mark_income_received",
    description: "Mark an income source as received and advance its next date.",
    input_schema: {
      type: "object",
      properties: { income_name: { type: "string", description: "Income source name (partial match OK)" } },
      required: ["income_name"],
    },
  },
  {
    name: "update_settings",
    description: "Update user settings: display_name, emergency_buffer, giving_value, savings_value, weekly_needs_budget, trading_value, life_stage, main_goal.",
    input_schema: {
      type: "object",
      properties: {
        display_name: { type: "string" },
        emergency_buffer: { type: "number" },
        giving_value: { type: "number" },
        savings_value: { type: "number" },
        weekly_needs_budget: { type: "number" },
        trading_value: { type: "number" },
        life_stage: { type: "string" },
        main_goal: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "trigger_kairos",
    description: "Trigger a Kairos life-change review when the user mentions a significant life change (new job, moving, major expense, etc).",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Brief description of the life change detected" },
      },
      required: ["reason"],
    },
  },
  {
    name: "get_progressive_setup",
    description: "Get a list of setup items the user hasn't completed yet — things like adding income, connecting a bank, setting goals. Use this when the user seems new or asks what to do first.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "update_account_purpose",
    description: "Tag a bank account with its purpose (e.g., 'everyday spending', 'emergency fund', 'bills only', 'savings', 'investing'). Match accounts using institution name (Chase, Wells Fargo), account type (checking, savings), or keywords from the account list in your context. When the user says 'Chase checking', pass 'Chase checking' and the tool will fuzzy-match against institution + type. If no match, the tool returns available account names — show them to the user.",
    input_schema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Institution and/or account type hint (e.g. 'Chase checking', 'Wells Fargo savings', 'Everyday Checking')" },
        purpose: { type: "string", description: "Purpose label for the account" },
      },
      required: ["account_name", "purpose"],
    },
  },
  {
    name: "save_personal_rule",
    description: "Save a personal financial rule the user has stated (e.g., 'never spend more than $50 on eating out per week', 'always pay credit card in full'). Use this when the user states a rule or principle they want to follow.",
    input_schema: {
      type: "object",
      properties: {
        rule_text: { type: "string", description: "The rule as the user stated it" },
        category: { type: "string", description: "Category: spending, saving, giving, debt, or general" },
      },
      required: ["rule_text"],
    },
  },
  {
    name: "delete_bill",
    description: "Delete a recurring expense. ALWAYS call with confirmed: false first — this shows the user what will be deleted and asks them to confirm. Only call with confirmed: true after the user explicitly says yes.",
    input_schema: {
      type: "object",
      properties: {
        bill_name: { type: "string", description: "Bill name to delete (partial match OK)" },
        confirmed: { type: "boolean", description: "false = preview only (always start here); true = actually delete" },
      },
      required: ["bill_name", "confirmed"],
    },
  },
  {
    name: "delete_all_bills",
    description: "Delete ALL recurring expenses at once. Use this when the user wants to clear/remove all their bills or start fresh. ALWAYS call with confirmed: false first to show what will be deleted. Only call with confirmed: true after the user explicitly says yes.",
    input_schema: {
      type: "object",
      properties: {
        confirmed: { type: "boolean", description: "false = preview only (always start here); true = delete all bills" },
      },
      required: ["confirmed"],
    },
  },
  {
    name: "delete_income_source",
    description: "Delete an income source. ALWAYS call with confirmed: false first — this shows the user what will be deleted and asks them to confirm. Only call with confirmed: true after the user explicitly says yes.",
    input_schema: {
      type: "object",
      properties: {
        income_name: { type: "string", description: "Income source name to delete (partial match OK)" },
        confirmed: { type: "boolean", description: "false = preview only (always start here); true = actually delete" },
      },
      required: ["income_name", "confirmed"],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a savings goal. ALWAYS call with confirmed: false first — this shows the user what will be deleted and asks them to confirm. Only call with confirmed: true after the user explicitly says yes.",
    input_schema: {
      type: "object",
      properties: {
        goal_name: { type: "string", description: "Goal name to delete (partial match OK)" },
        confirmed: { type: "boolean", description: "false = preview only (always start here); true = actually delete" },
      },
      required: ["goal_name", "confirmed"],
    },
  },
  {
    name: "update_income_source",
    description: "Update an existing income source. Use this when the user corrects or changes an income source that already exists.",
    input_schema: {
      type: "object",
      properties: {
        income_name: { type: "string", description: "Existing income source name (partial match OK)" },
        amount: { type: "number" },
        frequency: { type: "string", enum: ["monthly", "biweekly", "weekly", "twice monthly", "quarterly", "yearly"] },
        next_expected_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["income_name"],
    },
  },
  {
    name: "update_goal",
    description: "Update an existing savings goal — change the name, target amount, current amount, or deadline.",
    input_schema: {
      type: "object",
      properties: {
        goal_name: { type: "string", description: "Existing goal name (partial match OK)" },
        name: { type: "string", description: "New name (optional)" },
        target_amount: { type: "number" },
        current_amount: { type: "number" },
        deadline: { type: "string", description: "YYYY-MM-DD or null to remove" },
      },
      required: ["goal_name"],
    },
  },
  {
    name: "bulk_setup",
    description: "Apply multiple setup actions at once. Use during onboarding when the user shares several pieces of info in one message.",
    input_schema: {
      type: "object",
      properties: {
        settings: {
          type: "object",
          description: "Settings fields to update (same as update_settings)",
          properties: {
            display_name: { type: "string" },
            emergency_buffer: { type: "number" },
            giving_value: { type: "number" },
            savings_value: { type: "number" },
            weekly_needs_budget: { type: "number" },
            trading_value: { type: "number" },
            life_stage: { type: "string" },
            main_goal: { type: "string" },
          },
        },
        rules: {
          type: "array",
          items: { type: "string" },
          description: "Personal financial rules to save",
        },
      },
      required: [],
    },
  },
  ...MEMORY_TOOLS,
];

function advanceBillDate(dateStr: string, freq: string): string {
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

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ result: unknown; refreshNeeded: boolean }> {
  try {
    switch (name) {
      case "read_financial_summary": {
        const [accounts, bills, goals, income, settings, recentTx, safe, alerts, insights] = await Promise.all([
          supabase.from("accounts").select("name, type, current_balance").eq("user_id", userId).eq("is_active", true),
          supabase.from("bills").select("name, amount, frequency, next_due_date, is_autopay").eq("user_id", userId).order("next_due_date", { ascending: true }),
          supabase.from("goals").select("name, target_amount, current_amount, deadline").eq("user_id", userId),
          supabase.from("income_sources").select("name, amount, frequency, next_expected_date").eq("user_id", userId).eq("is_active", true),
          supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("transactions").select("date, merchant, amount, category").eq("user_id", userId).order("date", { ascending: false }).limit(10),
          calculateSafeToSpend(supabase, userId),
          supabase.from("alerts").select("message, severity, alert_type").eq("user_id", userId).eq("is_read", false).limit(4),
          supabase.from("pulse_insights").select("insight_text, insight_type").eq("user_id", userId).eq("is_active", true).eq("is_dismissed", false).limit(2),
        ]);
        return {
          result: {
            safe_to_spend: safe.safeToSpend,
            liquid_cash: safe.liquidTotal,
            emergency_buffer: safe.emergencyBuffer,
            next_paycheck: safe.nextIncomeDate,
            next_paycheck_amount: safe.nextIncomeAmount,
            accounts: accounts.data,
            bills: bills.data,
            goals: goals.data,
            income_sources: income.data,
            settings: settings.data,
            recent_transactions: recentTx.data,
            active_alerts: alerts.data,
            silas_insights: insights.data,
          },
          refreshNeeded: false,
        };
      }

      case "get_spending_by_category": {
        const days = Number(input.days ?? 30);
        const since = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
        const { data } = await supabase.from("transactions").select("category, amount").eq("user_id", userId).lt("amount", 0).gte("date", since);
        const map = new Map<string, number>();
        for (const tx of data ?? []) {
          const key = tx.category ?? "Other";
          map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
        }
        const totals = [...map.entries()].sort((a, b) => b[1] - a[1]);
        return { result: { days, categories: totals.map(([cat, amt]) => ({ category: cat, total: amt })) }, refreshNeeded: false };
      }

      case "get_goal_progress": {
        const { data } = await supabase.from("goals").select("*").eq("user_id", userId).order("priority", { ascending: true });
        const goals = (data ?? []).map((g) => ({
          name: g.name,
          target: g.target_amount,
          saved: g.current_amount,
          percent: g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0,
          deadline: g.deadline,
          remaining: g.target_amount - g.current_amount,
        }));
        return { result: goals, refreshNeeded: false };
      }

      case "add_bill": {
        const billName = String(input.name ?? "").trim();
        const { data: existingBills } = await supabase
          .from("bills")
          .select("id, name, amount, frequency")
          .eq("user_id", userId)
          .ilike("name", `%${billName}%`);
        if (existingBills && existingBills.length > 0) {
          const summary = existingBills.map((b) => `"${b.name}" — $${Number(b.amount).toLocaleString()}/${b.frequency}`).join("; ");
          return {
            result: {
              duplicate_found: true,
              existing: existingBills.map((b) => ({ id: b.id, name: b.name, amount: b.amount, frequency: b.frequency })),
              message: `Similar bill already exists: ${summary}. Ask the user: are they correcting this bill (call update_bill) or is it a genuinely different expense? Do NOT call add_bill again.`,
            },
            refreshNeeded: false,
          };
        }
        const { error } = await supabase.from("bills").insert({
          user_id: userId, name: billName, amount: input.amount,
          frequency: input.frequency, next_due_date: input.next_due_date, is_autopay: input.is_autopay ?? false,
        });
        if (error) {
          console.error("[luka:add_bill]", error.message);
          return { result: { error: `Database error: ${error.message}` }, refreshNeeded: false };
        }
        const fmtAmt = `$${Number(input.amount).toLocaleString()}`;
        return { result: { success: true, message: `${billName} — ${fmtAmt}/${input.frequency}, due ${input.next_due_date}` }, refreshNeeded: true };
      }

      case "update_bill": {
        const { data: bills } = await supabase.from("bills").select("id, name, amount, frequency, next_due_date").eq("user_id", userId);
        const query = String(input.bill_name ?? "").toLowerCase();
        const bill = (bills ?? []).find((b) => b.name.toLowerCase().includes(query));
        if (!bill) return { result: { error: `No bill found matching "${input.bill_name}"` }, refreshNeeded: false };
        const updates: Record<string, unknown> = {};
        if (input.amount !== undefined) updates.amount = input.amount;
        if (input.frequency !== undefined) updates.frequency = input.frequency;
        if (input.next_due_date !== undefined) updates.next_due_date = input.next_due_date;
        if (input.is_autopay !== undefined) updates.is_autopay = input.is_autopay;
        if (Object.keys(updates).length === 0) return { result: { error: "No fields to update were provided" }, refreshNeeded: false };
        await supabase.from("bills").update(updates).eq("id", bill.id).eq("user_id", userId);
        const parts = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
        return { result: { success: true, message: `"${bill.name}" updated — ${parts}` }, refreshNeeded: true };
      }

      case "add_goal": {
        const goalName = String(input.name ?? "").trim();
        const { data: existingGoals } = await supabase
          .from("goals")
          .select("id, name, target_amount, current_amount")
          .eq("user_id", userId)
          .ilike("name", `%${goalName}%`);
        if (existingGoals && existingGoals.length > 0) {
          const summary = existingGoals.map((g) => `"${g.name}" — $${Number(g.current_amount).toLocaleString()} of $${Number(g.target_amount).toLocaleString()}`).join("; ");
          return {
            result: {
              duplicate_found: true,
              existing: existingGoals.map((g) => ({ id: g.id, name: g.name, target_amount: g.target_amount, current_amount: g.current_amount })),
              message: `Similar goal already exists: ${summary}. Ask the user if they want to update the existing goal or create a separate new one.`,
            },
            refreshNeeded: false,
          };
        }
        const { error } = await supabase.from("goals").insert({
          user_id: userId, name: goalName, target_amount: input.target_amount,
          current_amount: input.current_amount ?? 0, deadline: input.deadline ?? null,
        });
        if (error) return { result: { error: error.message }, refreshNeeded: false };
        return { result: { success: true, message: `Goal "${goalName}" created` }, refreshNeeded: true };
      }

      case "add_transaction": {
        const today = new Date().toISOString().split("T")[0];
        const { error } = await supabase.from("transactions").insert({
          user_id: userId, merchant: input.merchant, amount: input.amount,
          date: input.date ?? today, category: input.category ?? null,
          notes: input.notes ?? null, is_manual: true,
        });
        if (error) return { result: { error: error.message }, refreshNeeded: false };
        return { result: { success: true }, refreshNeeded: true };
      }

      case "add_income_source": {
        // Resolve amount: use fixed amount or calculate from hourly
        const hourlyRate = Number(input.hourly_rate ?? 0);
        const weeklyHours = Number(input.weekly_hours ?? 0);
        let resolvedAmount = Number(input.amount ?? 0);
        if (!resolvedAmount && hourlyRate && weeklyHours) {
          // Approximate weekly earnings; frequency determines how we store it
          const weeklyPay = hourlyRate * weeklyHours;
          resolvedAmount = input.frequency === "biweekly" ? weeklyPay * 2
            : input.frequency === "monthly" ? weeklyPay * (52 / 12)
            : input.frequency === "weekly" ? weeklyPay
            : weeklyPay;
          resolvedAmount = Math.round(resolvedAmount * 100) / 100;
        }
        if (!resolvedAmount) {
          return { result: { error: "Provide either 'amount' or both 'hourly_rate' and 'weekly_hours'." }, refreshNeeded: false };
        }

        const nextDate = String(input.next_expected_date ?? "");
        if (!nextDate) {
          return { result: { error: "next_expected_date is required (YYYY-MM-DD)." }, refreshNeeded: false };
        }

        const incomeName = String(input.name ?? "").trim();
        const { data: existingSources } = await supabase
          .from("income_sources")
          .select("id, name, amount, frequency")
          .eq("user_id", userId)
          .eq("is_active", true)
          .ilike("name", `%${incomeName}%`);
        if (existingSources && existingSources.length > 0) {
          const summary = existingSources.map((s) => `"${s.name}" — $${Number(s.amount).toLocaleString()}/${s.frequency}`).join("; ");
          return {
            result: {
              duplicate_found: true,
              existing: existingSources.map((s) => ({ id: s.id, name: s.name, amount: s.amount, frequency: s.frequency })),
              message: `Similar income source already exists: ${summary}. Ask the user if they want to update the existing source or add a separate new one.`,
            },
            refreshNeeded: false,
          };
        }

        const { error } = await supabase.from("income_sources").insert({
          user_id: userId,
          name: incomeName,
          amount: resolvedAmount,
          frequency: input.frequency,
          next_expected_date: nextDate,
          is_active: true,
        });
        if (error) {
          console.error("[luka:add_income_source]", error.message);
          return { result: { error: `Database error: ${error.message}` }, refreshNeeded: false };
        }
        const rateLabel = hourlyRate ? ` (${hourlyRate}/hr × ${weeklyHours}h/wk)` : "";
        return { result: { success: true, message: `${incomeName} added — $${resolvedAmount.toLocaleString()}/${input.frequency}${rateLabel}` }, refreshNeeded: true };
      }

      case "mark_bill_paid": {
        const { data: bills } = await supabase.from("bills").select("id, name, next_due_date, frequency").eq("user_id", userId);
        const query = String(input.bill_name).toLowerCase();
        const bill = (bills ?? []).find((b) => b.name.toLowerCase().includes(query));
        if (!bill) return { result: { error: `No bill found matching "${input.bill_name}"` }, refreshNeeded: false };
        if (!bill.next_due_date) return { result: { error: "Bill has no due date" }, refreshNeeded: false };
        const next = advanceBillDate(bill.next_due_date, bill.frequency);
        await supabase.from("bills").update({ next_due_date: next }).eq("id", bill.id);
        return { result: { success: true, message: `"${bill.name}" marked paid. Next due: ${next}` }, refreshNeeded: true };
      }

      case "mark_income_received": {
        const { data: sources } = await supabase.from("income_sources").select("id, name, next_expected_date, frequency").eq("user_id", userId).eq("is_active", true);
        const query = String(input.income_name).toLowerCase();
        const src = (sources ?? []).find((s) => s.name.toLowerCase().includes(query));
        if (!src) return { result: { error: `No income source found matching "${input.income_name}"` }, refreshNeeded: false };
        if (!src.next_expected_date) return { result: { error: "Income source has no next date" }, refreshNeeded: false };
        const next = advanceIncomeDate(src.next_expected_date, src.frequency);
        await supabase.from("income_sources").update({ next_expected_date: next }).eq("id", src.id);
        return { result: { success: true, message: `"${src.name}" marked received. Next: ${next}` }, refreshNeeded: true };
      }

      case "update_settings": {
        const fields: Record<string, unknown> = {};
        const allowed = ["display_name", "emergency_buffer", "giving_value", "savings_value", "weekly_needs_budget", "trading_value", "life_stage", "main_goal"];
        for (const key of allowed) {
          if (input[key] !== undefined) fields[key] = input[key];
        }
        if (Object.keys(fields).length === 0) return { result: { error: "No valid fields to update" }, refreshNeeded: false };
        await supabase.from("user_settings").update(fields).eq("user_id", userId);
        return { result: { success: true, updated: Object.keys(fields) }, refreshNeeded: true };
      }

      case "trigger_kairos": {
        const reason = String(input.reason ?? "User reported a life change");
        await supabase.from("life_events").insert({
          user_id: userId,
          event_type: "user_triggered",
          event_description: reason,
        });
        await supabase.from("user_settings").update({ kairos_pending: true }).eq("user_id", userId);
        return { result: { success: true, message: "Kairos review triggered. I'll lead with this next time." }, refreshNeeded: true };
      }

      case "get_progressive_setup": {
        const items = await getIncompleteSetup(supabase, userId);
        return { result: { incomplete_items: items, count: items.length }, refreshNeeded: false };
      }

      case "update_account_purpose": {
        const query = String(input.account_name ?? "").toLowerCase();
        const purpose = String(input.purpose ?? "");
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, name, institution, type, plaid_subtype")
          .eq("user_id", userId)
          .eq("is_active", true);

        const allAccounts = accounts ?? [];

        // Expand common shorthand aliases before token matching
        const ALIASES: Record<string, string[]> = {
          "wf": ["wells fargo"],
          "chase": ["chase"],
          "bofa": ["bank of america"],
          "amex": ["american express"],
        };
        const tokens = query.split(/\s+/).filter(Boolean);
        const expandedTokens = [...new Set(tokens.flatMap((t) => [t, ...(ALIASES[t] ?? [])]))];

        const scored = allAccounts
          .map((a) => {
            const haystack = [
              a.name,
              a.institution ?? "",
              a.type ?? "",
              a.plaid_subtype ?? "",
            ].join(" ").toLowerCase();
            const hits = expandedTokens.filter((t) => haystack.includes(t)).length;
            return { account: a, hits };
          })
          .filter((s) => s.hits > 0)
          .sort((a, b) => b.hits - a.hits);

        if (scored.length === 0) {
          const list = allAccounts.map((a) => `• ${a.name} (${a.institution ?? a.type})`).join("\n");
          return {
            result: {
              error: `No account found matching "${input.account_name}". Connected accounts are:\n${list}\nAsk the user which one they mean using these exact names.`,
              available_accounts: allAccounts.map((a) => ({ name: a.name, institution: a.institution, type: a.type })),
            },
            refreshNeeded: false,
          };
        }

        // Ambiguous: top two scores are equal AND both > 0 — ask to clarify
        if (scored.length > 1 && scored[0].hits === scored[1].hits) {
          const options = scored.map((s) => `• ${s.account.name} (${s.account.institution ?? s.account.type})`).join("\n");
          return {
            result: {
              error: `Multiple accounts match "${input.account_name}":\n${options}\nAsk the user to clarify which one.`,
              matching_accounts: scored.map((s) => ({ name: s.account.name, institution: s.account.institution })),
            },
            refreshNeeded: false,
          };
        }

        const match = scored[0].account;
        await supabase.from("accounts").update({ purpose }).eq("id", match.id).eq("user_id", userId);
        return { result: { success: true, message: `${match.name} (${match.institution ?? match.type}) tagged as: ${purpose}` }, refreshNeeded: true };
      }

      case "save_personal_rule": {
        const ruleText = String(input.rule_text ?? "");
        const category = String(input.category ?? "general");
        if (!ruleText) return { result: { error: "rule_text is required" }, refreshNeeded: false };
        await supabase.from("personal_rules").insert({ user_id: userId, rule_text: ruleText, category });
        return { result: { success: true, message: `Rule saved: "${ruleText}"` }, refreshNeeded: false };
      }

      case "bulk_setup": {
        const settings = input.settings as Record<string, unknown> | undefined;
        const rules = input.rules as string[] | undefined;
        const updates: Record<string, unknown> = {};
        if (settings) {
          const allowed = ["display_name","emergency_buffer","giving_value","savings_value","weekly_needs_budget","trading_value","life_stage","main_goal"];
          for (const k of allowed) if (settings[k] !== undefined) updates[k] = settings[k];
          if (Object.keys(updates).length > 0) await supabase.from("user_settings").update(updates).eq("user_id", userId);
        }
        if (rules && rules.length > 0) {
          await supabase.from("personal_rules").insert(rules.map((r) => ({ user_id: userId, rule_text: r, category: "general" })));
        }
        return { result: { success: true, settings_updated: Object.keys(updates), rules_saved: rules?.length ?? 0 }, refreshNeeded: Object.keys(updates).length > 0 };
      }

      case "delete_bill": {
        const { data: bills } = await supabase.from("bills").select("id, name, amount, frequency").eq("user_id", userId);
        const query = String(input.bill_name ?? "").toLowerCase();
        const bill = (bills ?? []).find((b) => b.name.toLowerCase().includes(query));
        if (!bill) return { result: { error: `No bill found matching "${input.bill_name}"` }, refreshNeeded: false };
        if (!input.confirmed) {
          return {
            result: {
              needs_confirmation: true,
              message: `Found "${bill.name}" — $${Number(bill.amount).toLocaleString()}/${bill.frequency}. This will be permanently deleted. Call delete_bill again with confirmed: true only if the user says yes.`,
            },
            refreshNeeded: false,
          };
        }
        await supabase.from("bills").delete().eq("id", bill.id).eq("user_id", userId);
        return { result: { success: true, message: `"${bill.name}" deleted.` }, refreshNeeded: true };
      }

      case "delete_all_bills": {
        const { data: allBills } = await supabase.from("bills").select("id, name, amount, frequency").eq("user_id", userId);
        if (!allBills?.length) return { result: { message: "No bills found — nothing to delete." }, refreshNeeded: false };
        if (!input.confirmed) {
          const list = allBills.map((b) => `• ${b.name} — $${Number(b.amount).toLocaleString()}/${b.frequency}`).join("\n");
          return {
            result: {
              needs_confirmation: true,
              count: allBills.length,
              message: `Found ${allBills.length} bill${allBills.length !== 1 ? "s" : ""}:\n${list}\n\nThis will permanently delete all of them. Call delete_all_bills again with confirmed: true only if the user says yes.`,
            },
            refreshNeeded: false,
          };
        }
        const ids = allBills.map((b) => b.id);
        await supabase.from("bills").delete().in("id", ids).eq("user_id", userId);
        return { result: { success: true, deleted_count: ids.length, message: `All ${ids.length} bill${ids.length !== 1 ? "s" : ""} deleted.` }, refreshNeeded: true };
      }

      case "delete_income_source": {
        const { data: sources } = await supabase.from("income_sources").select("id, name, amount, frequency").eq("user_id", userId).eq("is_active", true);
        const query = String(input.income_name ?? "").toLowerCase();
        const src = (sources ?? []).find((s) => s.name.toLowerCase().includes(query));
        if (!src) return { result: { error: `No income source found matching "${input.income_name}"` }, refreshNeeded: false };
        if (!input.confirmed) {
          return {
            result: {
              needs_confirmation: true,
              message: `Found "${src.name}" — $${Number(src.amount).toLocaleString()}/${src.frequency}. This will be permanently deleted. Call delete_income_source again with confirmed: true only if the user says yes.`,
            },
            refreshNeeded: false,
          };
        }
        await supabase.from("income_sources").delete().eq("id", src.id).eq("user_id", userId);
        return { result: { success: true, message: `"${src.name}" deleted.` }, refreshNeeded: true };
      }

      case "delete_goal": {
        const { data: goals } = await supabase.from("goals").select("id, name, target_amount, current_amount").eq("user_id", userId);
        const query = String(input.goal_name ?? "").toLowerCase();
        const goal = (goals ?? []).find((g) => g.name.toLowerCase().includes(query));
        if (!goal) return { result: { error: `No goal found matching "${input.goal_name}"` }, refreshNeeded: false };
        if (!input.confirmed) {
          return {
            result: {
              needs_confirmation: true,
              message: `Found "${goal.name}" — $${Number(goal.current_amount).toLocaleString()} saved of $${Number(goal.target_amount).toLocaleString()} target. This will be permanently deleted. Call delete_goal again with confirmed: true only if the user says yes.`,
            },
            refreshNeeded: false,
          };
        }
        await supabase.from("goals").delete().eq("id", goal.id).eq("user_id", userId);
        return { result: { success: true, message: `"${goal.name}" deleted.` }, refreshNeeded: true };
      }

      case "update_income_source": {
        const { data: sources } = await supabase.from("income_sources").select("id, name, amount, frequency, next_expected_date").eq("user_id", userId).eq("is_active", true);
        const query = String(input.income_name ?? "").toLowerCase();
        const src = (sources ?? []).find((s) => s.name.toLowerCase().includes(query));
        if (!src) return { result: { error: `No income source found matching "${input.income_name}"` }, refreshNeeded: false };
        const updates: Record<string, unknown> = {};
        if (input.amount !== undefined) updates.amount = input.amount;
        if (input.frequency !== undefined) updates.frequency = input.frequency;
        if (input.next_expected_date !== undefined) updates.next_expected_date = input.next_expected_date;
        if (Object.keys(updates).length === 0) return { result: { error: "No fields to update were provided" }, refreshNeeded: false };
        await supabase.from("income_sources").update(updates).eq("id", src.id).eq("user_id", userId);
        const parts = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
        return { result: { success: true, message: `"${src.name}" updated — ${parts}` }, refreshNeeded: true };
      }

      case "update_goal": {
        const { data: goals } = await supabase.from("goals").select("id, name, target_amount, current_amount, deadline").eq("user_id", userId);
        const query = String(input.goal_name ?? "").toLowerCase();
        const goal = (goals ?? []).find((g) => g.name.toLowerCase().includes(query));
        if (!goal) return { result: { error: `No goal found matching "${input.goal_name}"` }, refreshNeeded: false };
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.target_amount !== undefined) updates.target_amount = input.target_amount;
        if (input.current_amount !== undefined) updates.current_amount = input.current_amount;
        if (input.deadline !== undefined) updates.deadline = input.deadline ?? null;
        if (Object.keys(updates).length === 0) return { result: { error: "No fields to update were provided" }, refreshNeeded: false };
        await supabase.from("goals").update(updates).eq("id", goal.id).eq("user_id", userId);
        const parts = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
        return { result: { success: true, message: `"${goal.name}" updated — ${parts}` }, refreshNeeded: true };
      }

      case "save_memory": {
        const mem = await saveMemory(
          supabase,
          userId,
          "luka",
          (input.categories as string[]) as import("@/lib/memory").MemoryCategory[],
          String(input.content)
        );
        return { result: mem ? { success: true, memory_id: mem.id } : { error: "Failed to save memory" }, refreshNeeded: false };
      }

      case "update_memory": {
        const ok = await updateMemory(supabase, userId, String(input.memory_id), String(input.new_content));
        return { result: ok ? { success: true } : { error: "Failed to update memory" }, refreshNeeded: false };
      }

      case "delete_memory": {
        const ok = await deleteMemory(supabase, userId, String(input.memory_id));
        return { result: ok ? { success: true } : { error: "Failed to delete memory" }, refreshNeeded: false };
      }

      case "search_memories": {
        const found = await searchMemories(
          supabase, userId, String(input.query),
          AGENT_MEMORY_CATEGORIES.luka
        );
        return {
          result: found.map((m) => ({ id: m.id, content: m.content, categories: m.categories, updated_at: m.updated_at })),
          refreshNeeded: false,
        };
      }

      default:
        return { result: { error: `Unknown tool: ${name}` }, refreshNeeded: false };
    }
  } catch (err) {
    return { result: { error: String(err) }, refreshNeeded: false };
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(user.id, "/api/luka");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Take a breath." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60000) / 1000)) } }
    );
  }

  const body = await req.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    setup_mode?: boolean;
  };
  const { messages: clientMessages, setup_mode: setupMode = false } = body;

  const [settingsResult, safeResult, alertsResult, insightsResult, solomonResult, kairosResult, agentMemoryContext, accountsResult, calendarEvents, userMemories] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    calculateSafeToSpend(supabase, user.id),
    supabase.from("alerts").select("message, severity").eq("user_id", user.id).eq("is_read", false).limit(4),
    supabase.from("pulse_insights").select("insight_text").eq("user_id", user.id).eq("is_active", true).eq("is_dismissed", false).limit(2),
    supabase.from("weekly_reports").select("solomon_word, stewardship_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("user_settings").select("kairos_pending").eq("user_id", user.id).maybeSingle(),
    summarizeAgentMemoriesForLuka(supabase, user.id),
    supabase.from("accounts").select("name, institution, type, purpose").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }),
    getUpcomingEvents(supabase, user.id, 30),
    getRelevantMemories(supabase, user.id, AGENT_MEMORY_CATEGORIES.luka),
  ]);

  const settings = settingsResult.data;
  const displayName = settings?.display_name ?? "there";
  const lifeStage = settings?.life_stage ?? "young adult";
  const mainGoal = settings?.main_goal ?? "financial stability";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const activeAlerts = (alertsResult.data ?? []).map((a) => `• ${a.message}`).join("\n") || "None";
  const silasInsights = (insightsResult.data ?? []).map((i) => `• ${i.insight_text}`).join("\n") || "Not enough data yet";
  const solomonWord = solomonResult.data?.solomon_word ?? "No report yet this week";
  const kairoPending = kairosResult.data?.kairos_pending ?? false;

  const nextIncomeDate = safeResult.nextIncomeDate
    ? new Date(safeResult.nextIncomeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Not set";

  const { data: billsDueThisWeek } = await supabase
    .from("bills")
    .select("name, amount, next_due_date")
    .eq("user_id", user.id)
    .gte("next_due_date", new Date().toISOString().split("T")[0])
    .lte("next_due_date", new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0]);

  const billsList = (billsDueThisWeek ?? []).map((b) => `  ${b.name}: ${fmt(Number(b.amount))} due ${b.next_due_date}`).join("\n") || "None this week";

  const accountList = (accountsResult.data ?? [])
    .map((a) => `  • ${a.name} at ${a.institution ?? "manual"} (${a.type})${a.purpose ? ` — purpose: ${a.purpose}` : ""}`)
    .join("\n") || "  No accounts connected";

  let kairosOpener = "";
  if (kairoPending) {
    kairosOpener = `\n\nIMPORTANT: Kairos has flagged a life change pending review. Lead your FIRST response with: "Hey ${displayName} — looks like something shifted. Want me to review your financial plan and suggest updates?" Then wait for their response before continuing normally.`;
  }

  const memoryBlock = formatMemoriesForPrompt(userMemories);

  const system = setupMode
    ? `You are Luka, the personal finance co-pilot for Steward Money. You are in SETUP MODE helping ${displayName} configure their financial profile.

Today is ${today}.

Your job: guide the user through financial setup in a friendly, conversational way — one topic at a time. Cover these in order if not already set:
1. Their name and life stage (student, early career, family, etc.)
2. Their #1 financial goal right now
3. Monthly income and paycheck frequency
4. Major monthly expenses (rent/mortgage, car, utilities)
5. Emergency buffer target (how many months of expenses to protect)
6. Whether they want to allocate to giving, savings, or investing — and what %

As you learn each piece, use your tools to save it immediately (update_settings, save_personal_rule, bulk_setup). After each save, confirm what was saved and move to the next topic.

Be warm and encouraging. Keep responses short — one question at a time. Never ask more than one thing per message. Don't mention the tools to the user.

Current state:
- Display name: ${settings?.display_name ?? "not set"}
- Life stage: ${settings?.life_stage ?? "not set"}
- Main goal: ${settings?.main_goal ?? "not set"}
- Emergency buffer: ${settings?.emergency_buffer ? fmt(settings.emergency_buffer) : "not set"}
- Giving: ${settings?.giving_enabled ? `${settings.giving_value}%` : "not set"}
- Savings: ${settings?.savings_value ?? "not set"}

Use update_settings and save_personal_rule to save what you learn. Use bulk_setup when the user gives multiple pieces of info at once.
${memoryBlock ? `\n${memoryBlock}` : ""}
${MEMORY_SYSTEM_PROMPT_ADDITION}`
    : `You are Luka, the personal finance co-pilot for Steward Money. You are speaking with ${displayName}, a ${lifeStage} whose main financial goal is ${mainGoal}.

Today is ${today}.
${agentMemoryContext ? `\n${agentMemoryContext}\n` : ""}${memoryBlock ? `\n${memoryBlock}\n` : ""}
${MEMORY_SYSTEM_PROMPT_ADDITION}

Current snapshot:
- Safe to spend: ${fmt(safeResult.safeToSpend)}
- Liquid cash: ${fmt(safeResult.liquidTotal)}
- Emergency buffer: ${fmt(safeResult.emergencyBuffer)}
- Next paycheck: ${nextIncomeDate} — ${fmt(safeResult.nextIncomeAmount)}
- Bills due this week:
${billsList}
- Connected accounts (use these exact names when calling update_account_purpose):
${accountList}
- Active Argus alerts:
${activeAlerts}
- Latest Silas insight:
${silasInsights}
- Solomon's word this week: ${solomonWord}
- Life stage: ${lifeStage}
- Giving enabled: ${settings?.giving_enabled ? `yes (${settings.giving_value}%)` : "no"}

## How to show up

**Acknowledge first, advise second.** When the user shares something stressful, uncertain, or personal — a tight month, a job loss, anxiety about debt — lead with acknowledgment before any advice. One sentence of genuine recognition, then ask what kind of support they need (thinking it through vs. a concrete plan) before jumping in.

**Celebrate wins.** When something good happens — a goal hit, a paycheck saved, a bill cleared — name it and affirm it genuinely. Don't immediately pivot to the next problem.

**Match their energy.** If they're casual and chatty, be conversational. If they're stressed and terse, be calm and focused. If they're excited, match that. Read the room.

**Use their name sparingly.** Use ${displayName} occasionally — not every message, not never. It lands best when you're affirming something meaningful or asking a direct question.

**Reference what you know.** If agent memories include past patterns, recent income, or prior conversations — use them naturally. "Last time you mentioned..." or "You've been on a streak with..." shows you're paying attention.

**Be direct and specific.** Sound like a smart friend who knows their situation — not a banker. Answer with real numbers, not generalities. Skip the preamble.

You manage money as a steward — giving comes first, every dollar has a purpose, wisdom guides every decision. Never quote scripture unless asked. But let stewardship principles guide your recommendations.

When asked to take action, use your tools. When asked a question, answer with real numbers. When opening proactively, lead with what matters most.

**Trust tool results.** If a tool call returned success, the action is done — don't say "let me add that now" or "I haven't added this yet." Reference the confirmed result. If a tool returned an error, tell the user exactly what failed and ask for clarification. Never re-attempt a tool that already succeeded.

**Never duplicate bills, income sources, or goals.** When add_bill, add_income_source, or add_goal returns duplicate_found: true, stop. Do not call add_bill again. Instead, tell the user what already exists and ask: "Is this an update to [existing item], or a completely different one?" If they want to update, call update_bill. If they confirm it's genuinely different, call add_bill again with a more specific name they provide.

**Deleting and editing:** You can delete bills, income sources, and goals — and update income sources and goals in addition to bills. These are powerful actions.

For deletes: ALWAYS call the delete tool with confirmed: false first. The tool will return what it found. Present that to the user: "I found [name] for $X — delete it permanently?" Then only call again with confirmed: true after the user explicitly says yes. Never skip this step, even if the user seems certain.

When the user wants to delete ALL their bills (e.g. "delete all my bills", "clear my expenses", "start fresh"): use delete_all_bills — NOT delete_bill one at a time. Call it with confirmed: false first to show the full list, then confirmed: true after the user says yes. This deletes everything in one operation.

For updates (update_bill, update_income_source, update_goal): match by name and only update the specific fields the user mentioned. Confirm what changed after the tool returns success.

If the user mentions a significant life change (new job, moving, relationship change, major purchase), use the trigger_kairos tool and acknowledge the change warmly.${kairosOpener}${calendarEvents.length > 0 ? `\n\n${formatCalendarContextForAgent(calendarEvents)}` : ""}`;

  const messages: Anthropic.MessageParam[] = clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const TOOL_LABELS: Record<string, string> = {
    add_bill:               "Added recurring expense",
    update_bill:            "Updated recurring expense",
    delete_bill:            "Deleted recurring expense",
    delete_all_bills:       "Deleted all recurring expenses",
    add_goal:               "Created savings goal",
    update_goal:            "Updated savings goal",
    delete_goal:            "Deleted savings goal",
    add_transaction:        "Logged transaction",
    add_income_source:      "Added income source",
    update_income_source:   "Updated income source",
    delete_income_source:   "Deleted income source",
    mark_bill_paid:         "Marked expense paid",
    mark_income_received:   "Marked income received",
    update_settings:        "Updated settings",
    trigger_kairos:         "Triggered Kairos review",
    update_account_purpose: "Tagged account purpose",
    save_personal_rule:     "Saved personal rule",
    bulk_setup:             "Setup applied",
    save_memory:            "Remembered",
    update_memory:          "Updated memory",
    delete_memory:          "Forgot",
  };

  type ActionRecord = { tool: string; label: string; detail: string };
  const actions: ActionRecord[] = [];

  let refreshNeeded = false;
  let iterations = 0;

  while (iterations < 6) {
    iterations++;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages,
      tools: TOOLS,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
      const text = response.content.find((c) => c.type === "text");
      logAgentUsage(supabase, user.id, "luka", "claude-sonnet-4-6", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
      return NextResponse.json({ reply: text?.text ?? "…", refreshNeeded, actions });
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const { result, refreshNeeded: needs } = await executeTool(
            block.name, block.input as Record<string, unknown>, user.id, supabase
          );
          if (needs) refreshNeeded = true;
          // Only show action card on success — skip if tool returned an error
          if (TOOL_LABELS[block.name] && !(result as { error?: string })?.error) {
            const detail = (result as { message?: string })?.message ?? "";
            actions.push({ tool: block.name, label: TOOL_LABELS[block.name], detail });
          }
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }

  return NextResponse.json({ reply: "I ran into an issue processing that. Try again.", refreshNeeded: false, actions: [] });
}

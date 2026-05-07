import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { advanceIncomeDate } from "@/lib/income";
import { summarizeAgentMemoriesForLuka } from "@/lib/agent-memory";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIncompleteSetup } from "@/lib/progressive-setup";

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
    description: "Create a new recurring expense.",
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
    description: "Add a new income source.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number" },
        frequency: { type: "string", enum: ["monthly", "biweekly", "weekly", "twice monthly", "quarterly", "yearly"] },
        next_date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["name", "amount", "frequency", "next_date"],
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
    description: "Update user settings: display_name, emergency_buffer, giving_pct, savings_pct, weekly_needs_budget, trading_pct, life_stage, main_goal.",
    input_schema: {
      type: "object",
      properties: {
        display_name: { type: "string" },
        emergency_buffer: { type: "number" },
        giving_pct: { type: "number" },
        savings_pct: { type: "number" },
        weekly_needs_budget: { type: "number" },
        trading_pct: { type: "number" },
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
    description: "Tag a bank account with its purpose (e.g., 'everyday spending', 'emergency fund', 'bills only', 'savings', 'investing').",
    input_schema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Partial account name to match" },
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
            giving_pct: { type: "number" },
            savings_pct: { type: "number" },
            weekly_needs_budget: { type: "number" },
            trading_pct: { type: "number" },
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
          supabase.from("income_sources").select("name, amount, frequency, next_date, next_expected_date").eq("user_id", userId).eq("is_active", true),
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
        const { error } = await supabase.from("bills").insert({
          user_id: userId, name: input.name, amount: input.amount,
          frequency: input.frequency, next_due_date: input.next_due_date, is_autopay: input.is_autopay ?? false,
        });
        if (error) return { result: { error: error.message }, refreshNeeded: false };
        return { result: { success: true, message: `Bill "${input.name}" added` }, refreshNeeded: true };
      }

      case "add_goal": {
        const { error } = await supabase.from("goals").insert({
          user_id: userId, name: input.name, target_amount: input.target_amount,
          current_amount: input.current_amount ?? 0, deadline: input.deadline ?? null,
        });
        if (error) return { result: { error: error.message }, refreshNeeded: false };
        return { result: { success: true, message: `Goal "${input.name}" created` }, refreshNeeded: true };
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
        const { error } = await supabase.from("income_sources").insert({
          user_id: userId, name: input.name, amount: input.amount,
          frequency: input.frequency, next_date: input.next_date,
          next_expected_date: input.next_date, is_active: true, is_variable: false,
        });
        if (error) return { result: { error: error.message }, refreshNeeded: false };
        return { result: { success: true, message: `Income source "${input.name}" added` }, refreshNeeded: true };
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
        const { data: sources } = await supabase.from("income_sources").select("id, name, next_date, next_expected_date, frequency").eq("user_id", userId).eq("is_active", true);
        const query = String(input.income_name).toLowerCase();
        const src = (sources ?? []).find((s) => s.name.toLowerCase().includes(query));
        if (!src) return { result: { error: `No income source found matching "${input.income_name}"` }, refreshNeeded: false };
        const currentDate = src.next_date || src.next_expected_date;
        if (!currentDate) return { result: { error: "Income source has no date" }, refreshNeeded: false };
        const next = advanceIncomeDate(currentDate, src.frequency);
        await supabase.from("income_sources").update({ next_date: next, next_expected_date: next }).eq("id", src.id);
        return { result: { success: true, message: `"${src.name}" marked received. Next: ${next}` }, refreshNeeded: true };
      }

      case "update_settings": {
        const fields: Record<string, unknown> = {};
        const allowed = ["display_name", "emergency_buffer", "giving_pct", "savings_pct", "weekly_needs_budget", "trading_pct", "life_stage", "main_goal"];
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
        const accountName = String(input.account_name ?? "").toLowerCase();
        const purpose = String(input.purpose ?? "");
        const { data: accounts } = await supabase.from("accounts").select("id, name").eq("user_id", userId).eq("is_active", true);
        const match = (accounts ?? []).find((a) => a.name.toLowerCase().includes(accountName));
        if (!match) return { result: { error: `No account found matching "${input.account_name}"` }, refreshNeeded: false };
        await supabase.from("accounts").update({ purpose }).eq("id", match.id).eq("user_id", userId);
        return { result: { success: true, message: `${match.name} tagged as: ${purpose}` }, refreshNeeded: true };
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
          const allowed = ["display_name","emergency_buffer","giving_pct","savings_pct","weekly_needs_budget","trading_pct","life_stage","main_goal"];
          for (const k of allowed) if (settings[k] !== undefined) updates[k] = settings[k];
          if (Object.keys(updates).length > 0) await supabase.from("user_settings").update(updates).eq("user_id", userId);
        }
        if (rules && rules.length > 0) {
          await supabase.from("personal_rules").insert(rules.map((r) => ({ user_id: userId, rule_text: r, category: "general" })));
        }
        return { result: { success: true, settings_updated: Object.keys(updates), rules_saved: rules?.length ?? 0 }, refreshNeeded: Object.keys(updates).length > 0 };
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

  const [settingsResult, safeResult, alertsResult, insightsResult, solomonResult, kairosResult, agentMemoryContext] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    calculateSafeToSpend(supabase, user.id),
    supabase.from("alerts").select("message, severity").eq("user_id", user.id).eq("is_read", false).limit(4),
    supabase.from("pulse_insights").select("insight_text").eq("user_id", user.id).eq("is_active", true).eq("is_dismissed", false).limit(2),
    supabase.from("weekly_reports").select("solomon_word, stewardship_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("user_settings").select("kairos_pending").eq("user_id", user.id).maybeSingle(),
    summarizeAgentMemoriesForLuka(supabase, user.id),
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

  let kairosOpener = "";
  if (kairoPending) {
    kairosOpener = `\n\nIMPORTANT: Kairos has flagged a life change pending review. Lead your FIRST response with: "Hey ${displayName} — looks like something shifted. Want me to review your financial plan and suggest updates?" Then wait for their response before continuing normally.`;
  }

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
- Savings %: ${settings?.savings_pct ?? "not set"}

Use update_settings and save_personal_rule to save what you learn. Use bulk_setup when the user gives multiple pieces of info at once.`
    : `You are Luka, the personal finance co-pilot for Steward Money. You are speaking with ${displayName}, a ${lifeStage} whose main financial goal is ${mainGoal}.

Today is ${today}.
${agentMemoryContext ? `\n${agentMemoryContext}\n` : ""}
Current snapshot:
- Safe to spend: ${fmt(safeResult.safeToSpend)}
- Liquid cash: ${fmt(safeResult.liquidTotal)}
- Emergency buffer: ${fmt(safeResult.emergencyBuffer)}
- Next paycheck: ${nextIncomeDate} — ${fmt(safeResult.nextIncomeAmount)}
- Bills due this week:
${billsList}
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

If the user mentions a significant life change (new job, moving, relationship change, major purchase), use the trigger_kairos tool and acknowledge the change warmly.${kairosOpener}`;

  const messages: Anthropic.MessageParam[] = clientMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const TOOL_LABELS: Record<string, string> = {
    add_bill:               "Added recurring expense",
    add_goal:               "Created savings goal",
    add_transaction:        "Logged transaction",
    add_income_source:      "Added income source",
    mark_bill_paid:         "Marked expense paid",
    mark_income_received:   "Marked income received",
    update_settings:        "Updated settings",
    trigger_kairos:         "Triggered Kairos review",
    update_account_purpose: "Tagged account purpose",
    save_personal_rule:     "Saved personal rule",
    bulk_setup:             "Setup applied",
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
          // Track write actions for transparency cards
          if (TOOL_LABELS[block.name]) {
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

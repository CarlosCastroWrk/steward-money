import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { getRelevantMemories, formatMemoriesForPrompt } from "@/lib/memory";

const anthropic = new Anthropic();

export interface LukaInsight {
  id: string;
  insight_text: string;
  generated_at: string;
  trigger_reason: "daily" | "category_jump" | "large_transaction" | "debug";
  is_active: boolean;
}

// Returns the single active insight for a user, or null
export async function getActiveInsight(
  supabase: SupabaseClient,
  userId: string
): Promise<LukaInsight | null> {
  const { data } = await supabase
    .from("luka_daily_insights")
    .select("id, insight_text, generated_at, trigger_reason, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LukaInsight | null) ?? null;
}

// Returns the UTC timestamp of today's local midnight for a given timezone
function getLocalMidnightUTC(timezone: string): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10) % 24;
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const s = parseInt(parts.find((p) => p.type === "second")!.value, 10);
  return new Date(now.getTime() - (h * 3600 + m * 60 + s) * 1000);
}

export interface CategoryJumpResult {
  triggered: boolean;
  category?: string;
  thisWeekAmount?: number;
  lastWeekAmount?: number;
  percentChange?: number;
}

export interface LargeTransactionResult {
  triggered: boolean;
  transaction?: { merchant: string; amount: number; date: string };
}

// >20% week-over-week jump with ≥$50 floor on current week
export async function detectCategoryJump(
  supabase: SupabaseClient,
  userId: string
): Promise<CategoryJumpResult> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, date, category")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("date", fourteenDaysAgo);

  if (!txs || txs.length === 0) return { triggered: false };

  const thisWeek: Record<string, number> = {};
  const lastWeek: Record<string, number> = {};

  for (const tx of txs) {
    const cat = (tx.category as string) ?? "Other";
    const amt = Math.abs(Number(tx.amount));
    if (tx.date >= sevenDaysAgo) {
      thisWeek[cat] = (thisWeek[cat] ?? 0) + amt;
    } else {
      lastWeek[cat] = (lastWeek[cat] ?? 0) + amt;
    }
  }

  let bestCat = "";
  let bestPct = 0;
  let bestThis = 0;
  let bestLast = 0;

  for (const [cat, thisAmt] of Object.entries(thisWeek)) {
    if (thisAmt < 50) continue;
    const lastAmt = lastWeek[cat] ?? 0;
    if (lastAmt === 0) continue;
    const pct = ((thisAmt - lastAmt) / lastAmt) * 100;
    if (pct > 20 && pct > bestPct) {
      bestPct = pct;
      bestCat = cat;
      bestThis = thisAmt;
      bestLast = lastAmt;
    }
  }

  if (!bestCat) return { triggered: false };
  return { triggered: true, category: bestCat, thisWeekAmount: bestThis, lastWeekAmount: bestLast, percentChange: bestPct };
}

// Any single expense ≥$200 in the last 24h
export async function detectLargeTransaction(
  supabase: SupabaseClient,
  userId: string
): Promise<LargeTransactionResult> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: txs } = await supabase
    .from("transactions")
    .select("merchant, amount, date, created_at")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("created_at", twentyFourHoursAgo)
    .order("amount", { ascending: true }) // most negative first
    .limit(1);

  if (!txs || txs.length === 0) return { triggered: false };
  const tx = txs[0];
  if (Math.abs(Number(tx.amount)) < 200) return { triggered: false };

  return {
    triggered: true,
    transaction: {
      merchant: (tx.merchant as string) ?? "Unknown",
      amount: Math.abs(Number(tx.amount)),
      date: tx.date as string,
    },
  };
}

export interface ShouldRegenerateResult {
  shouldRegen: boolean;
  reason: "daily" | "category_jump" | "large_transaction" | "no_change";
  todayCount: number;
  categoryJump: CategoryJumpResult | null;
  largeTx: LargeTransactionResult | null;
}

export async function shouldRegenerate(
  supabase: SupabaseClient,
  userId: string
): Promise<ShouldRegenerateResult> {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();

  const tz = (settings as { timezone?: string } | null)?.timezone ?? "America/Chicago";
  const localMidnight = getLocalMidnightUTC(tz);

  const { count } = await supabase
    .from("luka_daily_insights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("generated_at", localMidnight.toISOString());

  const todayCount = count ?? 0;

  if (todayCount >= 3) {
    return { shouldRegen: false, reason: "no_change", todayCount, categoryJump: null, largeTx: null };
  }

  const activeInsight = await getActiveInsight(supabase, userId);

  if (!activeInsight) {
    return { shouldRegen: true, reason: "daily", todayCount, categoryJump: null, largeTx: null };
  }

  if (new Date(activeInsight.generated_at) < localMidnight) {
    return { shouldRegen: true, reason: "daily", todayCount, categoryJump: null, largeTx: null };
  }

  // Fresh insight from today — only retrigger after 6h cooldown
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
  if (new Date(activeInsight.generated_at) > sixHoursAgo) {
    return { shouldRegen: false, reason: "no_change", todayCount, categoryJump: null, largeTx: null };
  }

  const [categoryJump, largeTx] = await Promise.all([
    detectCategoryJump(supabase, userId),
    detectLargeTransaction(supabase, userId),
  ]);

  if (categoryJump.triggered) {
    return { shouldRegen: true, reason: "category_jump", todayCount, categoryJump, largeTx: null };
  }
  if (largeTx.triggered) {
    return { shouldRegen: true, reason: "large_transaction", todayCount, categoryJump: null, largeTx };
  }

  return { shouldRegen: false, reason: "no_change", todayCount, categoryJump: null, largeTx: null };
}

function buildTriggerContext(
  reason: string,
  categoryJump: CategoryJumpResult | null,
  largeTx: LargeTransactionResult | null
): string {
  if (reason === "category_jump" && categoryJump?.triggered) {
    return `Category jump detected: ${categoryJump.category} up ${categoryJump.percentChange?.toFixed(0)}% week-over-week ($${categoryJump.thisWeekAmount?.toFixed(0)} this week vs $${categoryJump.lastWeekAmount?.toFixed(0)} last week)`;
  }
  if (reason === "large_transaction" && largeTx?.triggered) {
    return `Large transaction: $${largeTx.transaction?.amount.toFixed(0)} at ${largeTx.transaction?.merchant} on ${largeTx.transaction?.date}`;
  }
  if (reason === "debug") return "Debug force-regenerate";
  return "Daily baseline — no specific trigger";
}

async function callClaude(systemPrompt: string): Promise<string> {
  const FALLBACK = "Quiet week. Nothing unusual in your spending.";

  const tryParse = (raw: string): string | null => {
    const trimmed = raw.trim();
    try {
      const obj = JSON.parse(trimmed) as { insight?: string };
      return obj.insight?.trim() || null;
    } catch {
      const match = trimmed.match(/\{[\s\S]*?"insight"\s*:\s*"([\s\S]*?)"[\s\S]*?\}/);
      return match ? match[1].trim() : null;
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: "Generate today's insight." }],
      });
      const raw = response.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = tryParse(raw);
      if (parsed) return parsed;
    } catch (err) {
      console.error(`[daily-insight] Claude attempt ${attempt + 1} failed:`, err);
    }
  }

  return FALLBACK;
}

// Main entry point — checks if regen is needed and generates if so
export async function generateInsightIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  force = false
): Promise<LukaInsight | null> {
  const regenResult = force
    ? { shouldRegen: true, reason: "debug" as const, todayCount: 0, categoryJump: null, largeTx: null }
    : await shouldRegenerate(supabase, userId);

  if (!regenResult.shouldRegen) {
    return getActiveInsight(supabase, userId);
  }

  const triggerReason = regenResult.reason as LukaInsight["trigger_reason"];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

  const [safeResult, txsResult, billsResult, settingsResult, memories] = await Promise.all([
    calculateSafeToSpend(supabase, userId),
    supabase
      .from("transactions")
      .select("merchant, amount, date, category")
      .eq("user_id", userId)
      .lt("amount", 0)
      .gte("date", fourteenDaysAgo)
      .order("date", { ascending: false }),
    supabase
      .from("bills")
      .select("name, amount, next_due_date")
      .eq("user_id", userId)
      .is("paid_at", null)
      .gte("next_due_date", today)
      .lte("next_due_date", nextWeek)
      .order("next_due_date", { ascending: true }),
    supabase
      .from("user_settings")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    getRelevantMemories(supabase, userId, ["patterns", "financial"]),
  ]);

  const txs = txsResult.data ?? [];
  const thisWeekByCategory: Record<string, number> = {};
  const lastWeekByCategory: Record<string, number> = {};

  for (const tx of txs) {
    const cat = (tx.category as string) ?? "Other";
    const amt = Math.abs(Number(tx.amount));
    if ((tx.date as string) >= sevenDaysAgo) {
      thisWeekByCategory[cat] = (thisWeekByCategory[cat] ?? 0) + amt;
    } else {
      lastWeekByCategory[cat] = (lastWeekByCategory[cat] ?? 0) + amt;
    }
  }

  const topCategories = Object.entries(thisWeekByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amt]) => `  ${cat}: $${amt.toFixed(0)}`)
    .join("\n") || "  No spending data";

  const biggestChanges = Object.entries(thisWeekByCategory)
    .filter(([cat]) => lastWeekByCategory[cat] !== undefined)
    .map(([cat, thisAmt]) => {
      const lastAmt = lastWeekByCategory[cat];
      const pct = ((thisAmt - lastAmt) / lastAmt) * 100;
      return { cat, thisAmt, lastAmt, pct };
    })
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 5)
    .map(({ cat, thisAmt, lastAmt, pct }) =>
      `  ${cat}: $${thisAmt.toFixed(0)} this week vs $${lastAmt.toFixed(0)} last week (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)`
    )
    .join("\n") || "  Insufficient history for comparison";

  const recentTxList = txs
    .slice(0, 5)
    .map((tx) => `  ${tx.date}: ${(tx.merchant as string) ?? "Unknown"} $${Math.abs(Number(tx.amount)).toFixed(0)}`)
    .join("\n") || "  None";

  const billsList = (billsResult.data ?? [])
    .map((b) => `  ${b.name}: $${Number(b.amount).toFixed(0)} due ${b.next_due_date}`)
    .join("\n") || "  None this week";

  const triggerContext = buildTriggerContext(triggerReason, regenResult.categoryJump, regenResult.largeTx);
  const memoryBlock = formatMemoriesForPrompt(memories);
  const displayName = (settingsResult.data as { display_name?: string } | null)?.display_name ?? "the user";

  const systemPrompt = `You are Luka, the user's primary financial adviser in Steward Money.

Your job right now is to surface ONE observation about the user's money. Something they half-knew but couldn't articulate. Not a number — an observation.

VOICE:
- Warm, direct, not preachy
- 2-3 sentences total
- Lead with the observation, ground it in a specific number, close with a soft question or framing
- You are NOT a coach, NOT a critic, NOT a preacher
- Stewardship principles inform you but never come out as quotes or commands
- If you mention faith, do so as the user might to themselves, not as instruction

VOICE EXAMPLES (study these):
Good: "Coffee spending is up 60% this week — $78 across five visits, mostly mornings before BallerTV shifts. Worth noticing if those shifts are stressing you out."
Good: "You moved $400 into savings yesterday. That's the third week in a row. Quiet progress."
Good: "Eating out hit $312 this week vs. $190 last week. Most of it was Saturday and Sunday — anything going on?"
Bad: "You spent $127 on food this week." (That's a fact, not an insight.)
Bad: "Be careful — Proverbs 21:5 says..." (Preachy.)
Bad: "Great job on saving!" (Hollow praise.)
Bad: "Your category breakdown shows..." (Reads like a dashboard.)

TRIGGER CONTEXT:
${triggerContext}

USER SNAPSHOT (${displayName}):
- Safe to spend: $${safeResult.safeToSpend.toFixed(0)}
- Last 7 days by category (top 6):
${topCategories}
- Last 7 days vs prior 7 days (largest changes):
${biggestChanges}
- Recent transactions (last 5):
${recentTxList}
- Active bills this week:
${billsList}

USER MEMORIES (patterns and financial observations):
${memoryBlock || "No memories saved yet."}

OUTPUT:
A single JSON object with this exact shape:
{"insight": "<2-3 sentence insight following the voice rules above>"}

Nothing else. No preamble. No markdown. Just the JSON object.`;

  const insightText = await callClaude(systemPrompt);

  // Mark all prior insights inactive
  await supabase
    .from("luka_daily_insights")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data: newInsight, error } = await supabase
    .from("luka_daily_insights")
    .insert({ user_id: userId, insight_text: insightText, trigger_reason: triggerReason, is_active: true })
    .select("id, insight_text, generated_at, trigger_reason, is_active")
    .single();

  if (error) {
    console.error("[daily-insight] insert failed:", error.message);
    return getActiveInsight(supabase, userId);
  }

  return newInsight as LukaInsight;
}

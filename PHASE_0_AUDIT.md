# Phase 0 Audit — Steward Money Reset

Date: 2026-05-12

Author: Claude Code

Status: Read-only audit. No code changed.

---

## 1. Agent Inventory

| Agent | Status | Route file(s) | Dashboard component(s) | Pulse component | Notes |
|-------|--------|---------------|------------------------|-----------------|-------|
| Luka | KEEP | `app/api/luka/route.ts`, `app/api/luka/title/route.ts` | `LukaMorningBriefing.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Primary chat, 24+ tools, most complex route in codebase |
| Solomon | KEEP | `app/api/agents/solomon/route.ts`, `solomon/strategy/route.ts`, `solomon/latest/route.ts` | `SolomonWord.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Weekly report, stewardship score, Sunday cron |
| Kairos | KEEP | `app/api/agents/kairos/route.ts` | None — `last_plan_review` rendered inline in app/page.tsx line 345 | Card in CouncilCards | Calendar + life events, clarification cards |
| Echo | KEEP | `app/api/agents/echo/route.ts` | None | Card in CouncilCards | **Architecture mismatch — see Section 7** |
| Iron | KEEP | `app/api/agents/iron/route.ts` | None | Card in CouncilCards | Commitments + checkins, model discrepancy vs registry |
| Argus | ARCHIVE | `app/api/agents/argus/route.ts`, `app/api/agents/argus/alerts/route.ts` | No dedicated component — alerts rendered **inline** in app/page.tsx lines 108–129 | Card in CouncilCards | Writes to `alerts` table; Luka reads it |
| Silas | ARCHIVE | `app/api/agents/silas/route.ts` | `components/dashboard/SilasInsights.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Writes to `pulse_insights` table; Luka reads it |
| Manna | ARCHIVE | `app/api/agents/manna/route.ts` | `components/dashboard/MannaCard.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Writes to `manna_daily` table |
| Eden | ARCHIVE | `app/api/agents/eden/route.ts` | `components/dashboard/EdenMoment.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Writes to `vision_moments`; uses localStorage dismiss |
| Nova | ARCHIVE | `app/api/agents/nova/route.ts` | `components/dashboard/NovaMessage.tsx` (exists, NOT imported in app/page.tsx) | Card in CouncilCards | Writes to `nova_messages`; cron bug (see Section 7) |

---

## 2. The 5 Agents Staying — Current State

### Luka

- **Current system prompt summary:** Builds a live financial snapshot on every call: safe-to-spend, liquid cash, bills due this week, connected accounts, active Argus alerts, latest Silas insight, Solomon's weekly word, Kairos pending flag, calendar events, and user memories. Voice is warm and directive — "acknowledge first, advise second." Stewardship principles guide recommendations without being preachy.
- **Tools available:** `read_financial_summary`, `get_spending_by_category`, `get_goal_progress`, `add_bill`, `update_bill`, `delete_bill`, `delete_all_bills`, `add_goal`, `update_goal`, `delete_goal`, `add_transaction`, `add_income_source`, `update_income_source`, `delete_income_source`, `mark_bill_paid`, `mark_income_received`, `update_settings`, `trigger_kairos`, `get_progressive_setup`, `update_account_purpose`, `save_personal_rule`, `bulk_setup`, `save_memory`, `update_memory`, `delete_memory`, `search_memories` — 26 tools total.
- **How it's invoked:** POST `/api/luka` from the chat UI; up to 6 agentic loop iterations per call. Title generation via POST `/api/luka/title`. Setup mode via `setup_mode: true` body flag.
- **What's working:** Memory tools are well-implemented. Duplicate detection on add_bill/add_goal/add_income_source prevents accidental doubles. Two-step confirmation on deletes. Kairos trigger integration. The "acknowledge first" and "celebrate wins" instructions in the system prompt directly support the peace-first vision. Calendar context already injected.
- **What needs rewriting:**
  - System prompt at `app/api/luka/route.ts` lines 914–917 explicitly references "Active Argus alerts" and "Latest Silas insight" — both from archived agents. These must be removed.
  - `read_financial_summary` tool result at lines 334–335 fetches from `alerts` and `pulse_insights` tables and includes them in what it returns to Claude (lines 349–351). The tool description at line 28 also mentions "Argus alerts" and "Silas insight."
  - POST handler at lines 823–824 fetches `alertsResult` and `insightsResult` for the system prompt context. Both queries hit archived-agent tables.
  - The `registry.ts` systemPrompt for Luka (line 53) is a placeholder — the real prompt is built dynamically in `route.ts`. The registry entry could be cleaned up to reflect that.
- **Risk level for Phase 1 rewrite:** Medium — Luka works now, but has 4 distinct places referencing the two archived agents (system prompt lines 841/914–917, tool result lines 334–335/349–351, tool description line 28, POST handler lines 823–824). Miss any one of these and Claude will keep asking about alerts that no longer exist.

---

### Solomon

- **Current system prompt summary:** Weekly report agent. Uses biblical-stewardship framing — "giving comes first, every dollar has a purpose." Speaks like a mentor. Generates a `solomon_word` (2–3 sentence wisdom statement specific to the user's numbers) and a stewardship score (1–100) based on giving, saving, provision, and categorization.
- **Tools available:** None — all logic is in the route. Calls Claude once per report generation via a structured prompt baked into `runSolomon()`.
- **How it's invoked:** POST `/api/agents/solomon` (Sunday cron or manual). GET `/api/agents/solomon` returns this week's report. GET `/api/agents/solomon/latest` returns the current week's report (slightly different field selection). GET `/api/agents/solomon/strategy` generates a 2–3 sentence strategic recommendation via haiku.
- **What's working:** Weekly rhythm is right for peace-first. The `stewardship_score` gives Los a concrete feedback signal without anxiety. The `solomon_word` is already injected into Luka's system prompt, so it persists across the week. The strategy endpoint is a lightweight haiku call — good separation.
- **What needs rewriting:** The registry `systemPrompt` at line 66 is decent but is not the prompt actually used for weekly report generation — that's in `runSolomon()` at lines 91–99. Minimal changes needed. The long-view, mentor voice is a strong fit for the peace-first vision.
- **Risk level for Phase 1 rewrite:** Low — Solomon is self-contained, has no dependencies on archived agents, and its current voice already matches the new direction.

---

### Kairos

- **Current system prompt summary:** Calendar-aware agent who watches timing. Surfaces upcoming events that affect finances, detects life transitions (goal completions, spending shifts, persistent negative balance), and generates clarification cards for ambiguous calendar events. Voice is "aware of timing" — patient, pointed, not anxious.
- **Tools available:** None directly — internally calls `detectKairosEvents()` and `getUpcomingEvents()`. Returns `clarification_cards` (three types: `clarify`, `confirm_expense`, `recurring_pattern`) via GET.
- **How it's invoked:** POST `/api/agents/kairos` (Luka's `trigger_kairos` tool or manual). GET `/api/agents/kairos` returns pending flag + life events + calendar insights + clarification cards. PATCH clears `kairos_pending` and sets `last_plan_review`.
- **What's working:** The clarification card system is sophisticated and genuinely useful for calendar-connected users. The `kairos_pending` flag and Luka opener flow is clean. Life event detection (goal completed, spending shift, persistent negative) covers real transition signals.
- **What needs rewriting:** The registry `systemPrompt` at lines 79–89 is a good description but is only used when Kairos appears as a chat agent in the detail page. The route itself doesn't use it. The voice ("There's a season for everything") fits the peace-first vision well.
- **Risk level for Phase 1 rewrite:** Low — no dependencies on archived agents. Calendar integration is working. The system prompt in the registry could be tightened but it's not broken.

---

### Echo

- **Current system prompt summary:** Registry describes Echo as a memory keeper who quotes users back to themselves, surfaces past context proactively, and holds memories as gifts. The registry `systemPrompt` at line 167 is used only when Echo appears as a chat agent via the agent detail page (which calls `/api/agents/chat`, not the Echo route). `lib/memory.ts` lines 189–190 also defines `ECHO_SYSTEM_PROMPT_ADDITION` for proactive memory surfacing.
- **Tools available:** Via `/api/agents/echo` route: GET (list all `echo_memories`), POST (upsert by key), DELETE (by ID). This is a key-value CRUD API against the `echo_memories` table — not the `user_memories` categorized system.
- **How it's invoked:** `/api/agents/echo` route is a REST API. Echo as a conversational agent is served by the generic `/api/agents/chat` route (referenced in `AgentChatModal.tsx` line 87), using the registry `systemPrompt`.
- **What's working:** The registry system prompt for Echo's conversational persona is well-written and fits the peace-first vision (memory as a gift, not a weapon).
- **What needs rewriting:** Two separate memory systems exist for Echo — `echo_memories` (key-value, via its route) and `user_memories` (categorized, shared system from `lib/memory.ts`). These are disconnected. The `/api/agents/echo` route does not implement the "proactively surfaces relevant past memories" behavior described in CLAUDE.md. Echo's conversational behavior (via chat) has no access to its own `echo_memories` table because chat goes through `/api/agents/chat`, not `/api/agents/echo`.
- **Risk level for Phase 1 rewrite:** Medium — Echo is technically functional as a chat agent, but its memory architecture is inconsistent. Needs a decision (see Section 9, Question 1) before Phase 1 can define the right implementation.

---

### Iron

- **Current system prompt summary:** Accountability agent. Reads commitments with streak/adherence data. Generates a 1–2 sentence checkin response: affirm when kept (genuine, not generic), redirect when missed (gracious, not harsh). "Be Iron: honest, brief, accountable, kind."
- **Tools available:** None directly — GET returns enriched commitments (streak, adherenceRate, recentCheckins), POST handles `create` or `checkin` actions, calling Claude only for the checkin feedback message.
- **How it's invoked:** GET `/api/agents/iron` (commitments + checkins). POST `/api/agents/iron` with `{ action: "create" | "checkin" }`.
- **What's working:** The enriched commitment data (streak + adherence rate) is good signal. The two-step create/checkin pattern is clean. Voice matches the "motivating professional" description in the new brief — not mean, just direct.
- **What needs rewriting:** The registry `model` field at line 108 says `claude-haiku-4-5-20251001`, but the route at line 71 uses `claude-sonnet-4-6`. The registry field is never read by the route — it's documentation only, and it's wrong. The greeting "Let's be honest" and color `#ef4444` (red) in the registry evoke severity; with the peace-first reset, consider whether Iron's color should soften.
- **Risk level for Phase 1 rewrite:** Low — Iron is self-contained, well-implemented, and no KEEP agent reads from Iron's tables. The model discrepancy is cosmetic.

---

## 3. The 5 Agents Getting Archived — Removal Map

### Argus

- **Route files to leave alone (code stays):** `app/api/agents/argus/route.ts`, `app/api/agents/argus/alerts/route.ts`
- **UI to remove imports/renders for:**
  - `app/page.tsx` line 66: remove `alertsResult` from the `Promise.all()` fetch
  - `app/page.tsx` lines 108–129: remove the entire alerts rendering block (severity-colored alert cards + "View all in Pulse" link)
  - `app/page.tsx` line 46: remove `alertsResult` from the destructured results
  - No dedicated dashboard component — `LukaMorningBriefing.tsx` exists but is NOT imported in `app/page.tsx`; it's already dormant
- **Cross-agent dependencies:**
  - `app/api/luka/route.ts` line 823: `alertsResult` fetch from `alerts` table — remove
  - `app/api/luka/route.ts` line 840: `activeAlerts` variable built from alertsResult — remove
  - `app/api/luka/route.ts` lines 914–915: system prompt block `"- Active Argus alerts:\n${activeAlerts}"` — remove
  - `app/api/luka/route.ts` line 28–30 (tool description for `read_financial_summary`): remove "Argus alerts" from description
  - `app/api/luka/route.ts` line 334: `supabase.from("alerts")...` inside `read_financial_summary` executeTool — remove
  - `app/api/luka/route.ts` line 349: `active_alerts: alerts.data` in the returned result object — remove
- **Database / memory side effects:** Argus writes to `alerts` (via its route) and `agent_memories` (via `saveAgentMemory()`). The `agent_memories` entries will remain but age out naturally as Luka reads only the 5 most recent. The `alerts` table will stop receiving new rows once the cron is disabled; existing rows will remain until manually cleared or the table is dropped.
- **Removal risk:** Medium — Argus has the deepest tentacles into Luka and the dashboard of all 5 archived agents.

---

### Silas

- **Route files to leave alone (code stays):** `app/api/agents/silas/route.ts`
- **UI to remove imports/renders for:**
  - `components/dashboard/SilasInsights.tsx` — component exists but NOT currently imported in `app/page.tsx`. Safe to delete the file.
- **Cross-agent dependencies:**
  - `app/api/luka/route.ts` line 823: `insightsResult` fetch from `pulse_insights` — remove
  - `app/api/luka/route.ts` line 841: `silasInsights` variable built from insightsResult — remove
  - `app/api/luka/route.ts` lines 916–917: system prompt block `"- Latest Silas insight:\n${silasInsights}"` — remove
  - `app/api/luka/route.ts` line 335: `supabase.from("pulse_insights")...` inside `read_financial_summary` — remove
  - `app/api/luka/route.ts` line 350: `silas_insights: insights.data` in returned result — remove
- **Database / memory side effects:** Writes to `pulse_insights` and `agent_memories`. The `pulse_insights` table will have stale rows (marked `is_active: true`) until the table is cleaned or Silas's next run sets them to `is_active: false`. Luka currently queries this live — once removed from Luka's prompt, the stale data causes no harm.
- **Removal risk:** Medium — same Luka system prompt cleanup required as Argus; the two are parallel.

---

### Manna

- **Route files to leave alone (code stays):** `app/api/agents/manna/route.ts`
- **UI to remove imports/renders for:**
  - `components/dashboard/MannaCard.tsx` — exists, NOT imported in `app/page.tsx`. Safe to delete.
- **Cross-agent dependencies:** None found. No KEEP agent reads from `manna_daily` or references Manna in system prompts.
- **Database / memory side effects:** Writes to `manna_daily` (one row per user per day) and `agent_memories`. Orphaned data causes no harm.
- **Removal risk:** Low — fully isolated from KEEP agents.

---

### Eden

- **Route files to leave alone (code stays):** `app/api/agents/eden/route.ts`
- **UI to remove imports/renders for:**
  - `components/dashboard/EdenMoment.tsx` — exists, NOT imported in `app/page.tsx`. Safe to delete. Note: component uses `localStorage.setItem(dismissKey, "1")` — deleting the component removes that localStorage key from future sessions, but existing keys in users' browsers are harmless.
- **Cross-agent dependencies:** None found. No KEEP agent reads from `vision_moments` or references Eden.
- **Database / memory side effects:** Writes to `vision_moments` and `agent_memories`. Orphaned data is harmless.
- **Removal risk:** Low — fully isolated from KEEP agents.

---

### Nova

- **Route files to leave alone (code stays):** `app/api/agents/nova/route.ts`
- **UI to remove imports/renders for:**
  - `components/dashboard/NovaMessage.tsx` — exists, NOT imported in `app/page.tsx`. Safe to delete.
- **Cross-agent dependencies:** None found. No KEEP agent reads from `nova_messages` or references Nova.
- **Database / memory side effects:** Writes to `nova_messages` (with `is_read` flag) and `agent_memories`. Orphaned data is harmless.
- **Removal risk:** Low — fully isolated from KEEP agents. (The cron bug in this route — see Section 7 — is moot once the cron is disabled.)

---

## 4. Pulse Page Architecture

**Current component tree:**
```
app/pulse/page.tsx
  └── PulseView (components/pulse/PulseView.tsx)
        └── CouncilCards (components/pulse/CouncilCards.tsx)
              └── AgentCard × 10 (inline, rendered for each agent in AGENT_ORDER)
                    → router.push(`/pulse/${agent}`) on tap
                          └── app/pulse/[agent_name]/page.tsx
                                ├── Insight tab (static display of last 3 assistant messages)
                                └── Chat tab → AgentChat (components/agents/AgentChat.tsx)
```

**How agent cards are rendered today:** `CouncilCards` fetches two queries in parallel — `agent_unread_counts` and the last 50 assistant messages from `agent_conversations`. Each `AgentCard` shows: agent name + role, last assistant message (or placeholder), time ago, unread badge. The 10 agents are rendered in `AGENT_ORDER` (line 8–11 of `CouncilCards.tsx`): `luka, solomon, kairos, argus, iron, manna, eden, nova, echo, silas`.

**What changes when dropping to 5:**
- Remove `argus, manna, eden, nova, silas` from `AGENT_ORDER` (line 8–11 in `CouncilCards.tsx`)
- Remove their entries from `PLACEHOLDERS` (lines 13–24 in `CouncilCards.tsx`)
- Update the subtitle in `PulseView.tsx` line 10: `"Your ten agents. Tap any to open a conversation."` — needs to change
- The unread count queries still work cleanly — they only show badges for agents that appear in the list

**Agent detail page:** `app/pulse/[agent_name]/page.tsx` currently validates against `Object.keys(AGENT_REGISTRY)` (line 9) — so all 10 agents are valid routes. After archival, navigating directly to `/pulse/argus` would still render a (possibly empty) agent page. A guard should be added to return a "not found" screen for archived agent names.

**`AgentChatModal.tsx` status:** This component (`components/pulse/AgentChatModal.tsx`) is a full-screen chat modal that posts to `/api/agents/chat`. It is not rendered anywhere in the current codebase — the agent detail page uses `AgentChat` instead. It is dead code and can be deleted in Phase 1.

---

## 5. Home Page Agent Surface Area

**Current state of `app/page.tsx` (from reading the file):**

The following agent-related items ARE currently rendered in `app/page.tsx`:
- **Argus alerts** (lines 66, 108–129): fetches `alerts` table and renders severity-colored cards with "View all in Pulse" link. This is the only archived-agent UI surface currently active on the dashboard.
- **Kairos** (line 345): `settingsResult.data?.last_plan_review` renders a "Plan reviewed [date] · Kairos" footer — this is a KEEP agent, keep as-is.

The following components **exist** but are **NOT imported or rendered** in `app/page.tsx`:
- `LukaMorningBriefing.tsx` — Luka
- `SolomonWord.tsx` — Solomon
- `SilasInsights.tsx` — Silas
- `MannaCard.tsx` — Manna
- `EdenMoment.tsx` — Eden
- `NovaMessage.tsx` — Nova

**Recommended disposition:**

| Component | Keep / Remove / Replace |
|-----------|------------------------|
| Argus alerts block (inline, lines 108–129) | **Remove** — Argus is archived |
| `LukaMorningBriefing.tsx` | **Evaluate** — currently unused. If the new vision wants a daily Luka insight on the dashboard, this is the right slot. See Section 9, Question 3. |
| `SolomonWord.tsx` | **Evaluate** — currently unused. Solomon's weekly word is already surfaced in Luka's system prompt. Could be added to the dashboard overview tab if Los wants it visible. |
| `SilasInsights.tsx` | **Delete** — Silas is archived |
| `MannaCard.tsx` | **Delete** — Manna is archived |
| `EdenMoment.tsx` | **Delete** — Eden is archived |
| `NovaMessage.tsx` | **Delete** — Nova is archived |

**Phase 2 flag:** The current dashboard overview tab has no persistent agent presence beyond the Argus alerts (which are being removed). A Luka daily insight card or Solomon word — replacing the Argus alerts slot at lines 108–129 — would maintain the "adviser who knows you" feel without adding new features. This is Phase 2 scope, but flag it now.

---

## 6. Cross-Agent Memory & Shared State

**Two separate memory systems exist:**

**System 1: `agent_memories` table** (simple, per-agent summaries)
- Written by: all 10 agents via `saveAgentMemory()` in `lib/agent-memory.ts`
- Read by: Luka only, via `summarizeAgentMemoriesForLuka()` which fetches the 5 most recent records across all agents
- Format: `agent`, `summary` (plain text), `importance` (1–10), `created_at`
- Effect of archival: Argus, Silas, Manna, Eden, Nova entries remain in the table but will age out of Luka's 5-most-recent window naturally as new KEEP agent memories are added. No cleanup required, but Luka may surface stale archived-agent observations for a period after archival.

**System 2: `user_memories` table** (categorized, multi-tag, permanent)
- Written by: Luka (via chat tools), and theoretically all agents via `lib/memory.ts`
- Read by: Luka (all categories), Solomon, Kairos, Iron, Echo — each scoped to their allowed categories per `AGENT_MEMORY_CATEGORIES` in `registry.ts`
- Format: `categories[]`, `content`, `saved_by_agent`, `deleted_at` (soft delete)
- Effect of archival: None — archived agents never implemented save_memory tools in their routes. Only Luka actively writes to `user_memories`. The category scopes for archived agents (Argus: `patterns, financial`; Silas: `patterns, financial`; Manna: `faith, preferences`; Eden: `faith, relationships, identity`; Nova: `patterns, financial`) in `registry.ts` can stay or be cleaned — they're inert after archival.

**Orphaned-data risk assessment:**
- `alerts` table: Stops receiving new rows after Argus cron is disabled. Old alerts will persist. If the dashboard still queries this table (it currently does — app/page.tsx line 66), they'll continue to show stale alerts until the fetch is removed.
- `pulse_insights` table: Silas marks old insights `is_active: false` on each run. After archival, the last batch of insights remain `is_active: true` indefinitely. Luka queries this table in its system prompt context (line 823). Remove the fetch to eliminate stale data from Luka's context.
- `manna_daily`, `nova_messages`, `vision_moments`: No KEEP agent reads these. Orphaned data is harmless.

**Cron jobs in `vercel.json`:** Not read in this audit, but Argus and Silas have daily cron routes (confirmed by their route files). If their crons continue firing after archival, they will keep writing to `alerts` and `pulse_insights`. Phase 1 should disable these cron entries.

---

## 7. Bugs Found During Audit

- **`app/api/agents/nova/route.ts` line 92 — cron uses wrong Supabase client — Severity: High**
  In the cron branch (lines 85–97), `admin` is created on line 87 (`const admin = createAdminClient()`). But on line 92, `createClient()` is called instead of `admin`. `createClient()` in a cron context (no active user session) will return an unauthenticated client. The `generateNovaMessage()` function then calls `calculateSafeToSpend(supabase, userId)` with this unauthenticated client — queries will fail RLS or return null data. Nova cron has been silently broken for all users.

- **`app/api/agents/echo/route.ts` — Echo architecture is disconnected from its described role — Severity: Medium**
  The route (lines 1–51) is a REST CRUD API for the `echo_memories` table using a key-value schema (`memory_key`, `memory_value`). This is a different table and schema from `user_memories` (the categorized system in `lib/memory.ts`). When Echo is opened as a chat agent via `/pulse/echo`, the chat goes through `AgentChat` → `/api/agents/chat`, using the registry `systemPrompt`. That system prompt references Echo as a "memory keeper who quotes users back to themselves" — but the chat has no access to `echo_memories` or `user_memories`. The `ECHO_SYSTEM_PROMPT_ADDITION` in `lib/memory.ts` (lines 189–190) is defined but not injected into any active route. Echo's conversational identity and its data layer are disconnected.

- **`lib/agents/registry.ts` line 108 — Iron model field is wrong — Severity: Low**
  Registry declares Iron uses `claude-haiku-4-5-20251001`. The Iron route at `app/api/agents/iron/route.ts` line 71 calls `model: "claude-sonnet-4-6"`. The route doesn't read from the registry `model` field — it hardcodes its own. The registry is incorrect documentation.

- **`components/pulse/AgentChatModal.tsx` — unreachable dead component — Severity: Low**
  This component is never rendered by any current route or page. The agent detail page (`app/pulse/[agent_name]/page.tsx`) uses `AgentChat`, not `AgentChatModal`. The component posts to `/api/agents/chat` but there's no path to mount it in the current UI.

- **`app/api/luka/route.ts` lines 334–335, 349–351 — `read_financial_summary` will return stale archived-agent data post-archival — Severity: Low**
  After Argus and Silas are archived, the `alerts` and `pulse_insights` queries inside `read_financial_summary` continue to run and return whatever stale rows remain in those tables. No crash, but Claude may reference outdated alert data when the user calls `read_financial_summary`.

---

## 8. Phase 1 Recommendations

Ordered by dependency — do these in sequence, not in parallel.

**Pulse / navigation:**
- Remove `"argus", "manna", "eden", "nova", "silas"` from `AGENT_ORDER` in `components/pulse/CouncilCards.tsx` lines 8–11
- Remove their entries from `PLACEHOLDERS` in `components/pulse/CouncilCards.tsx` lines 13–24
- Update subtitle in `components/pulse/PulseView.tsx` line 10: replace `"Your ten agents. Tap any to open a conversation."` with `"Your five agents. Tap any to open a conversation."` (or simply `"Your council."`)
- Add archived-agent guard in `app/pulse/[agent_name]/page.tsx` after line 68: if agent name is in `["argus", "silas", "manna", "eden", "nova"]`, return a "This adviser has been retired" screen instead of the full detail page

**Dashboard (app/page.tsx):**
- Remove `alertsResult` from the `Promise.all()` at line 58–73 (it's the 8th item)
- Remove `alertsResult` from the destructured results at line 46
- Remove the entire alerts rendering block `app/page.tsx` lines 108–129 (the `{alerts.length > 0 && ...}` block)
- Remove the `alerts` variable assignment at line 80

**Luka system prompt cleanup (app/api/luka/route.ts):**
- Remove `insightsResult` fetch (line 823) from the `Promise.all()`
- Remove `alertsResult` fetch (line 822) — wait, it's line 822 in the large Promise.all; remove both
- Remove `silasInsights` and `activeAlerts` variable declarations (lines 840–841)
- Remove the system prompt lines that inject these: `"- Active Argus alerts:\n${activeAlerts}"` and `"- Latest Silas insight:\n${silasInsights}"` (lines 914–917)
- Inside `executeTool()`, remove `supabase.from("alerts")...` and `supabase.from("pulse_insights")...` from the `read_financial_summary` case (lines 334–335)
- Remove `active_alerts` and `silas_insights` from the returned result object (lines 349–351)
- Update the `read_financial_summary` tool description (line 28–30): remove "Argus alerts" and "Silas insight" from the description text

**Dead component cleanup:**
- Delete `components/dashboard/SilasInsights.tsx`
- Delete `components/dashboard/NovaMessage.tsx`
- Delete `components/dashboard/MannaCard.tsx`
- Delete `components/dashboard/EdenMoment.tsx`
- Delete `components/pulse/AgentChatModal.tsx` (confirmed dead code — no import anywhere)
- Confirm `LukaMorningBriefing.tsx` and `SolomonWord.tsx` are unused (grep for imports), then decide whether to keep as Phase 2 shells or delete

**Cron jobs:**
- Disable Argus and Silas cron entries in `vercel.json` (do not delete — leave commented or flagged for reference)
- Disable Nova cron if it exists in `vercel.json`

**Registry cleanup:**
- In `lib/agents/registry.ts`, update Iron's `model` field (line 108) from `claude-haiku-4-5-20251001` to `claude-sonnet-4-6` to match the actual route
- Optionally remove `argus`, `silas`, `manna`, `eden`, `nova` from `AGENT_MEMORY_CATEGORIES` (lines 21–26) — they are inert but misleading

**Do NOT do in Phase 1:**
- Do not modify `lib/safe-to-spend.ts` or `middleware.ts`
- Do not rewrite Luka's system prompt beyond the Argus/Silas removal — the existing voice already fits the peace-first vision
- Do not add new features (new dashboard widget, Solomon word on homepage, etc.) — that's Phase 2

---

## 9. Open Questions for Los

1. **Echo's two memory tables.** `/api/agents/echo` writes to `echo_memories` (key-value). The shared memory system uses `user_memories` (categorized). These don't talk to each other. Echo's described "proactive memory surfacing" behavior isn't implemented in any route. Before Phase 1, decide: should `echo_memories` be the primary store (and Echo gets a real chat route that uses it), or should Echo be merged into the `user_memories` system and the `echo_memories` table retired?

2. **Argus alerts table: remove immediately or drain first?** After disabling the Argus cron, old alerts persist in the `alerts` table. If the dashboard fetch is removed in Phase 1, they become invisible to the user (correct). But should the existing alerts be deleted from the DB now, or left as historical data? This affects whether the `alerts` table should be retained long-term or dropped after the codebase cleanup.

3. **`LukaMorningBriefing.tsx` and `SolomonWord.tsx` — keep or delete?** Both components exist but aren't imported anywhere in `app/page.tsx`. They appear to have been built and then removed from the dashboard. Do you want to delete them (clean), or keep them as candidate shells for a future "Luka daily snapshot" and "Solomon weekly word" slot on the dashboard overview tab? This affects Phase 2 planning.

4. **What replaces the Argus alerts slot on the dashboard?** Lines 108–129 in `app/page.tsx` currently show Argus alerts as a high-priority block between the greeting and the safe-to-spend card. After removal, that slot is empty. Is the intent to leave a cleaner/quieter dashboard (no alert surface at all), or should Luka's daily briefing (`LukaMorningBriefing`) or Solomon's word slot in?

5. **Vercel cron configuration.** The audit confirmed Argus and Silas have active cron routes, and Nova likely does too. These cron entries live in `vercel.json` (not read in this audit — out of scope). Before Phase 1 ships, confirm which crons exist for archived agents and whether simply disabling the cron route is sufficient, or if the routes themselves need a guard (e.g., return 200 immediately if called) to avoid Vercel flagging repeated 4xx responses.

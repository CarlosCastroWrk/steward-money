# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build
npm run lint      # ESLint via next lint
npx tsc --noEmit  # Type-check without emitting (run this before committing)
```

## Off-Limits Files

These files must not be modified without explicit user instruction:

- `lib/safe-to-spend.ts` — the financial calculation source of truth. Bugs here cascade to every screen showing money.
- `middleware.ts` — auth + onboarding routing. Bugs here lock users out.

If a task seems to require changes to these files, STOP and ask the user before proceeding. Do not refactor "while you're in there." Do not make even small style, comment, or formatting changes to these files.

## Deploy Workflow

This project operates as an agentic workflow. After every successful build that completes both `npx tsc --noEmit` and `npm run build` without errors:

1. `git add . && git commit -m "<short descriptive message>"`
2. `git push origin main`
3. `vercel --prod`
4. Report the deploy URL and commit SHA in the chat
5. If significant changes shipped, run `npm run verify:deploy` and report pass/fail

If any step fails: stop, report the error, do not retry blindly. If the failure is in TypeScript or build, investigate the cause before proceeding.

After every ship, append a section to STATUS.md with the date, commit SHA, and what changed. This is the audit trail for the project — future agents and humans rely on it.

## Decision-Making

This project is built as an agentic workflow where AI agents operate the application across user, developer, and CEO perspectives. When tasks are ambiguous, default to these patterns:

1. **Diagnose before fixing.** For high-stakes changes (DB schema, auth, payments, financial calc), report what was found before changing anything. Wait for confirmation on the fix direction.

2. **Don't fix unrelated things "while you're in there."** Note them in chat for later, but do not include them in the current diff. Surgical changes only.

3. **Don't guess.** Don't guess column names, environment variables, external API response shapes, or library behavior. Read the actual schema, check actual env, fetch actual docs. If still unsure, report and ask.

4. **Don't refactor large files (>500 lines) mid-feature.** Note the file as a refactor candidate for STATUS.md and proceed surgically.

5. **Don't introduce new dependencies or design systems without approval.** No shadcn migration, no MUI, no Chakra, no new state management libraries mid-task. Stick with Tailwind plus existing primitives unless the user explicitly approves a new direction.

6. **Stop and report if scope expands unexpectedly.** If a "small fix" reveals 10 related issues, surface them in a list. Do not silently fix all 10. Let the user decide what's in scope for this session.

7. **Operate as if this app were already launched.** Code, decisions, and tradeoffs should reflect production thinking: real users, real money, real consequences. Build with developer rigor, user empathy, and CEO accountability.

## Project Documents

Before making significant changes, check these files for context:

- `STATUS.md` — running log of what shipped, when, and why. Append after every ship with date, commit SHA, and summary.
- `AUDIT_2026-05-09.md` — most recent full-codebase audit. Lists known deferred issues and priority order for technical debt.
- `tests/README.md` — testing conventions and test account setup.

These documents are the project's institutional memory. They prevent rediscovery of issues already known and ensure new work builds on the documented state rather than guesses.

## Testing

Playwright E2E tests run against the live production app. Test files are in `tests/e2e/`.

```bash
npm run test:e2e          # Headless (fast)
npm run test:e2e:headed   # Watch the browser navigate in real time
npm run verify:deploy     # Run mobile tests against production — use after every significant ship
```

**After significant ships:** run `npm run verify:deploy` and include the pass/fail result in your report. If tests fail, investigate before pushing additional changes.

Requires `.env.test.local` with `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` (dedicated test account — see `tests/README.md`).

TypeScript check (`npx tsc --noEmit`) is still the primary correctness gate for code. E2E tests verify feature behavior.

## Architecture

**StewardMoney** is a personal financial operating system built on Next.js 14 App Router, Supabase (auth + database), Anthropic SDK (AI agents), and Plaid (bank connectivity).

### Auth & Routing

`middleware.ts` runs on every request. It enforces three states:
1. Not authed → redirect to `/login`
2. Authed but onboarding incomplete → redirect to `/onboarding`
3. Authed + onboarded → allow through

Supabase auth uses `@supabase/ssr`. Three client factories:
- `lib/supabase/server.ts` — React `cache()`-wrapped, for Server Components and API routes
- `lib/supabase/client.ts` — browser client for Client Components
- `lib/supabase/admin.ts` — service role client used only in cron paths

All DB queries are scoped to `user.id` via RLS on every table.

### The Five Active Agents

The active council is Luka, Solomon, Kairos, Iron, and Echo. Each has an API route under `/api/agents/` (Luka is at `/api/luka`). Cron routes are identified by the `x-vercel-cron: 1` header and use the admin client. All agents can call `saveAgentMemory()` from `lib/agent-memory.ts`.

| Agent | Route | Trigger | Storage |
|-------|-------|---------|---------|
| **Luka** | `/api/luka` | Chat messages from client | — (stateless, uses session messages) |
| **Solomon** | `/api/agents/solomon` | Sunday cron 9am + manual POST | `weekly_reports` table |
| **Kairos** | `/api/agents/kairos` | Luka `trigger_kairos` tool + event detection | `life_events` table; sets `kairos_pending` on `user_settings` |
| **Iron** | `/api/agents/iron` | Manual POST from Pulse | `commitments` + `commitment_checkins` tables |
| **Echo** | `/api/agents/chat` | Chat messages from client (same route as other agents) | `user_memories` table |

**Five archived agents** (routes exist but are UI-removed, no crons): Argus, Silas, Manna, Eden, Nova. The `app/pulse/[agent_name]/page.tsx` shows a retirement message for these. Do not add new UI surfaces for them.

**Solomon sub-routes**: `GET /api/agents/solomon/latest` returns the current week's report. `GET /api/agents/solomon/strategy` generates a 2-3 sentence strategic recommendation via claude-haiku-4-5-20251001.

**Luka** is the only chat agent with live financial data. Its system prompt is built fresh on every call: safe-to-spend, latest Solomon word, connected account list, and whether Kairos has a pending life-change review. It uses `claude-sonnet-4-6`.

**Luka agentic loop**: `app/api/luka/route.ts` runs up to 6 iterations. Each iteration calls the Anthropic API; if `stop_reason === "tool_use"`, tools are executed and results are appended as a `user` role message before the next iteration. Only the final `end_turn` response text is returned to the client. Tool action cards are only added to the response when the tool returns `success: true` (never on error).

**Kairos pending flow**: when `kairos_pending = true` in `user_settings`, Luka's system prompt instructs it to open with a plan review prompt. After the review, call `PATCH /api/agents/kairos` to clear the flag and set `last_plan_review`.

### Cross-Agent Memory System

All five active agents read from and write to the `user_memories` table. The architecture is **Hybrid + Categorized**.

- **Hybrid save model**: agents auto-save important facts based on conversation context AND users can explicitly trigger save with phrases like "remember that..." or delete with "forget that...". Agents announce saves in chat with a "Remembered" pill so users see what was captured.

- **Categorized storage**: memories are tagged with one or more of six categories: `identity`, `financial`, `faith`, `relationships`, `patterns`, `preferences`. Stored as a `text[]` array on each memory row (multi-tag, one row per memory — never duplicate rows per category).

- **Per-agent scoping**: each agent only reads memories whose categories overlap with that agent's allowed set. See `AGENT_MEMORY_CATEGORIES` in `lib/agents/registry.ts`. Example: Solomon reads `faith + financial + identity`; Echo reads `identity + relationships + patterns + preferences`; Luka reads all categories.

- **Memory page**: `/more/memory` displays all memories grouped by category with agent badge dots, inline edit, delete, search, and "Clear all" per category.

Tools available to all agents (via system prompts):
- `save_memory(categories, content)` — multi-tag in a single INSERT
- `update_memory(memory_id, new_content)`
- `delete_memory(memory_id)` — soft delete via deleted_at
- `search_memories(query)` — text search across user's full memory bank regardless of calling agent's scope (so "forget" can find memories saved by any agent)

Echo has a special role: with access to identity, relationships, patterns, and preferences, she proactively surfaces relevant past memories at conversation start. Other agents save passively; Echo recalls actively.

### Core Financial Logic

`lib/safe-to-spend.ts` — the single source of truth for the "Safe to Spend" number:
```
safeToSpend = liquidCash - billsDueSoon - emergencyBuffer - weeklyNeeds - giving - savings - trading
```
`billsDueSoon` = bills due before the next income date (not just 7 days). Always pass the Supabase client and userId — never cache across users.

`lib/income.ts` — income date advancement. `advanceStaleIncomeDates()` is called on dashboard load to silently push past-due income dates forward before any UI renders.

`lib/format.ts` — `formatUSD()` and `formatDate()`. Use these everywhere for consistency. `formatDate()` returns human-readable strings: "Today", "Tomorrow", "in 3 days", "Apr 28".

`lib/stewardship.ts` — stewardship scoring rubric and `scoreStewardship()`. Solomon uses this to compute the weekly 1–10 score.

`lib/agent-memory.ts` — `saveAgentMemory(supabase, userId, agentName, summary, importance)`. Agents call this to persist key observations.

### Database Schema

Migrations in `supabase/migrations/`. Key tables:

- `user_settings` — one row per user, holds all allocation rules (giving, savings, trading, needs budgets), `emergency_buffer`, `kairos_pending`, `last_plan_review`, `personal_vision`, `display_name`, `life_stage`, `main_goal`
- `income_sources` — primary date column is `next_expected_date` (NOT `next_date` — that column does not exist). Only update `next_expected_date` when advancing dates.
- `bills` — `next_due_date` is the primary field. Advancing after payment is done in application code (not via DB trigger).
- `accounts` — key columns: `plaid_type` ("depository" | "credit" | "loan" | "investment"), `plaid_subtype`, `available_balance` (only set for depository accounts — represents spendable cash after pending), `current_balance` (present balance for all types), `credit_limit` (credit/loan only), `purpose` (user-assigned label), `last_synced`. Always use `plaid_type` as the source of truth for account classification, falling back to the human-readable `type` field for manual accounts.
- `alerts` — written by Argus. Has `agent`, `alert_type`, `is_read`, `severity`. Deduplicated by `alert_type` within 24h.
- `pulse_insights` — written by Silas. Dismissed per-row in DB (not localStorage).
- `weekly_reports` — one per user per `week_start` date. Upserted each Sunday.
- `life_events` — append-only log written by Kairos. Cleared via `acknowledged = true`.
- `calendar_connections` — one row per user when Google Calendar is linked. Stores `access_token`, `refresh_token`, `expires_at`.
- `calendar_events_cache` — cached Google Calendar events. Key columns: `event_type` ("income" | "expense" | "social" | "personal" | "needs_clarification"), `confidence` ("high" | "medium" | "low"), `user_confirmed` (boolean), `user_categorized_as` (user's own label), `spending_estimate` (only meaningful when `event_type=expense` AND `user_confirmed=true`). Never show `spending_estimate` as a cost unless both conditions hold.
- `calendar_patterns` — learned per-user patterns. When a user confirms 3+ events with the same keyword as the same type, a pattern row is created so future events with that keyword are auto-categorized without AI.
- `nova_messages`, `manna_daily`, `commitments`, `commitment_checkins`, `vision_moments`, `agent_memories` — written by agents (archived agents write to their tables but are no longer triggered from UI).
- `user_memories` — the primary memory table used by all five active agents. Replaces the retired `echo_memories` system.

RLS is enabled on all tables — every policy uses `auth.uid() = user_id`.

### Plaid Balance Semantics

Plaid returns three balance fields — map them per account type:

| Plaid type | `current_balance` | `available_balance` | `credit_limit` |
|---|---|---|---|
| depository | present balance | spendable cash (current minus pending) | null |
| credit | amount owed | **do not use** (remaining credit line, not cash) | credit limit |
| loan | amount owed | null | loan limit if available |

`safe-to-spend` uses `available_balance ?? current_balance` for depository accounts only. Credit and loan balances are excluded from liquid cash.

### UI Conventions

**Design tokens**: CSS variables in `globals.css` support light/dark via `.dark` class toggle on `<html>`. Always use CSS variables — never hardcode `text-white`, `text-zinc-*`, or `bg-white text-black`.

Text tokens (both forms are defined; components use the shorthand):
- `--text-1` / `--text-primary` — primary text
- `--text-2` / `--text-secondary` — secondary/subdued text
- `--text-3` / `--text-muted` — muted/hint text
- `--text-dim` — faintest

Background: `--bg-base`, `--bg-card`, `--bg-elevated`, `--bg-inset`, `--bg-hover`

Border: `--border` (same as `--border-default`), `--border-subtle`, `--border-default`, `--border-strong`

Accent: `--accent`, `--accent-deep`, `--accent-glow`, `--accent-border`

Agent colors: `--luka`, `--argus`, `--solomon`, `--silas`, `--kairos`, `--eden`, `--iron`, `--nova`, `--echo`, `--manna`

Semantic Tailwind colors that work in both modes: `text-emerald-500` (income/success), `text-red-500` (danger), `text-amber-500` (warning), `text-[var(--accent)]` (purple, primary/Luka).

**Agent avatars**: `components/AgentAvatar.tsx` — use `agent="luka"|"solomon"|"argus"|"silas"|"kairos"|"eden"|"nova"|"manna"|"iron"|"echo"`.

**Toast notifications**: `ToastProvider` is in layout. Use `const toast = useToast()` → `toast("message")` or `toast("message", "error")`.

**Page metadata**: all pages export `export const metadata: Metadata = { title: "Page Name" }`. The layout template produces `"Page Name — Steward Money"`.

**Settings inputs**: use `INPUT_CLASS` and `LABEL_CLASS` from `components/settings/types.ts` — these are already CSS-variable-aware. Primary action buttons use `bg-[var(--accent)] text-white`; secondary use `border-[var(--border-default)] text-[var(--text-secondary)]`.

### Navigation

- **Bottom nav (mobile)**: Home / Expenses / Pulse / Card — defined in `components/BottomNav.tsx`. More menu: Activity / Accounts / Goals / Decide / Settings.
- **Sidebar (desktop)**: `components/Sidebar.tsx`.
- **Transactions page** is branded as **Activity** (`/transactions`).

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV                       # "sandbox" | "development" | "production"
ANTHROPIC_API_KEY               # Used server-side only in agent routes
SUPABASE_SERVICE_ROLE_KEY       # Used only in lib/supabase/admin.ts (cron paths)
# RESEND_API_KEY removed May 2026 — welcome email feature scrapped.
# Do not re-add /api/email/welcome route without explicit user instruction.
NEXT_PUBLIC_APP_URL             # Full app URL for email links (e.g. https://steward-money.vercel.app)

# Google Calendar (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID    # From console.cloud.google.com OAuth credentials
GOOGLE_CLIENT_SECRET            # Same source. Uses GSI implicit token flow — register
                                # JavaScript Origins in Google Cloud Console (no redirect URI needed).
                                # Hit /api/calendar/diagnostic for exact setup instructions.
```

### Google Calendar Integration

Uses the **GSI implicit token flow** (not OAuth redirect). Only JavaScript Origins need to be registered in Google Cloud Console — no redirect URI.

Calendar routes under `/api/calendar/`:
- `connect` — POST: saves access token; GET: checks connection status
- `sync` — POST: fetches events from Google, classifies with claude-haiku-4-5-20251001, upserts to cache. Checks `calendar_patterns` first — matched events skip AI. GET: returns cached upcoming events.
- `confirm` — POST: `{ event_id, event_type, category, cost_estimate? }` — marks an event as user-confirmed and checks if a new pattern should be learned (threshold: 3 confirmed events with same keyword).
- `status` — GET: returns connection status + upcoming event count.
- `diagnostic` — GET: returns setup instructions and required JavaScript Origins.
- `auto-sync` — cron-only (requires `x-vercel-cron: 1`), runs daily.

`lib/calendar-context.ts` — `getUpcomingEvents()` + `formatCalendarContextForAgent()`. The format function only surfaces confirmed costs in agent system prompts — never guesses.

**Kairos GET** (`/api/agents/kairos`) returns `clarification_cards` — a list of structured questions for ambiguous events in the next 14 days. Three card types: `clarify` (working or attending?), `confirm_expense` (out of pocket?), `recurring_pattern` (track all as work?). PulseView renders these as `KairosClarificationCard` with inline choice buttons that POST to `/api/calendar/confirm`.

**ComingUpWidget display rules for calendar events:**
- `event_type=income`: green tint, "earning" badge or `+$X` if amount known
- `event_type=expense` + `user_confirmed=true`: red/amber tint, show cost
- `event_type=expense` + not confirmed: neutral, no cost
- `event_type=social`: blue tint, no cost
- `event_type=personal`: neutral, no cost
- `event_type=needs_clarification`: amber tint, `?` badge, no cost

### Plaid Integration

Link flow: `PlaidLinkButton` → `/api/plaid/create-link-token` → Plaid Link → `/api/plaid/exchange-token` → `/api/plaid/sync`. Transactions sync via webhook at `/api/plaid/webhook`. Plaid connection metadata lives in `plaid_items`.

`/api/plaid/sync` — user-triggered sync (POST). Supports `{ deep: true }` body for 90-day lookback (default 30). Returns `item_errors` array when any Plaid item fails so the caller can surface per-institution errors.

`/api/plaid/auto-sync` — cron-only (requires `x-vercel-cron: 1` header), runs daily at 6am via `vercel.json`. Uses admin client to sync all users.

`PLAID_ENV=sandbox` during development — sandbox returns synthetic transactions that include unrealistic merchants.

## Security Posture

This app handles real financial data and real user identities. Security rules are non-negotiable:

- **RLS on every table**, scoped to `auth.uid() = user_id`. New tables must include RLS policies in their migration before any code reads from or writes to them.

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) only used in `lib/supabase/admin.ts`. Admin client is only acceptable in cron routes. Never use it to bypass RLS for convenience.

- **Cron routes** require both the `CRON_SECRET` environment variable check AND the `x-vercel-cron: 1` header. See `lib/cron-auth.ts`. Without both checks, cron endpoints can be hit by anyone on the internet and burn Anthropic credits.

- **Plaid webhooks** verify JWT signature via Plaid's verification endpoint, plus a 5-minute replay window via timestamp check. See `/api/plaid/webhook`.

- **All API routes require auth checks** unless explicitly public (webhooks only). Public routes must include a comment explaining why they are unauthenticated.

- **No secrets in client code, URLs, error messages, or logs.** Plaid, Anthropic, Supabase service role, and any future API keys must remain server-side only. If a sensitive value would appear in a URL query parameter, switch to a POST body or server action.

- **Audit before deploy if security-adjacent code changes.** Auth, RLS policies, cron handlers, webhook verifiers, and the admin client all warrant a slow read before pushing.

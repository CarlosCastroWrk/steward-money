# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build
npm run lint      # ESLint via next lint
npx tsc --noEmit  # Type-check without emitting (run this before committing)
```

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

### The Ten Agents

Each agent is an API route under `/api/agents/`. Cron routes are identified by the `x-vercel-cron: 1` header and use the admin client to iterate all users. All agents can call `saveAgentMemory()` from `lib/agent-memory.ts` to persist observations to the `agent_memories` table.

| Agent | Route | Trigger | Storage |
|-------|-------|---------|---------|
| **Luka** | `/api/luka` | Chat messages from client | — (stateless, uses session messages) |
| **Argus** | `/api/agents/argus` | Dashboard load + daily cron 8am | `alerts` table |
| **Solomon** | `/api/agents/solomon` | Sunday cron 9am + manual POST | `weekly_reports` table |
| **Silas** | `/api/agents/silas` | Sunday cron 9am + manual POST | `pulse_insights` table |
| **Kairos** | `/api/agents/kairos` | Luka `trigger_kairos` tool + event detection | `life_events` table; sets `kairos_pending` on `user_settings` |
| **Eden** | `/api/agents/eden` | Manual POST from Pulse | `vision_moments` table; reads `personal_vision` from `user_settings` |
| **Nova** | `/api/agents/nova` | Behavioral triggers + cron | `nova_messages` table |
| **Manna** | `/api/agents/manna` | Dashboard load / daily | `manna_daily` table |
| **Iron** | `/api/agents/iron` | Manual POST from Pulse | `commitments` + `commitment_checkins` tables |
| **Echo** | `/api/agents/echo` | Read/write agent memory | `echo_memories` table |

**Argus sub-routes**: `GET /api/agents/argus/alerts` returns max 4 unread alerts (used by Pulse — does NOT run the full agent).

**Solomon sub-routes**: `GET /api/agents/solomon/latest` returns the current week's report. `GET /api/agents/solomon/strategy` generates a 2-3 sentence strategic recommendation via claude-haiku-4-5-20251001.

**Luka** is the only agent users interact with directly. Its system prompt is built fresh on every call using live data: safe-to-spend, active Argus alerts, top Silas insights, latest Solomon word, connected account list, and whether Kairos has a pending life-change review. It uses `claude-sonnet-4-6`.

**Luka agentic loop**: `app/api/luka/route.ts` runs up to 6 iterations. Each iteration calls the Anthropic API; if `stop_reason === "tool_use"`, tools are executed and results are appended as a `user` role message before the next iteration. Only the final `end_turn` response text is returned to the client. Tool action cards are only added to the response when the tool returns `success: true` (never on error).

**Kairos pending flow**: when `kairos_pending = true` in `user_settings`, Luka's system prompt instructs it to open with a plan review prompt. After the review, call `PATCH /api/agents/kairos` to clear the flag and set `last_plan_review`.

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
- `nova_messages`, `manna_daily`, `commitments`, `commitment_checkins`, `vision_moments`, `echo_memories`, `agent_memories` — written by newer agents.

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

- **Bottom nav (mobile)**: Home / Expenses / Pulse / Card — defined in `components/BottomNav.tsx`. More menu: Activity / Accounts / Goals / Decide / Council / Settings.
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
RESEND_API_KEY                  # Welcome email on signup — get from resend.com
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

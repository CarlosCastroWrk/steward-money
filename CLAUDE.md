# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build
npm run lint      # ESLint via next lint
npx tsc --noEmit  # Type-check without emitting (run this before committing)
```

No test suite exists. TypeScript check is the primary correctness gate.

## Architecture

**StewardMoney** is a personal financial operating system built on Next.js 14 App Router, Supabase (auth + database), Anthropic SDK (AI agents), and Plaid (bank connectivity).

### Auth & Routing

`middleware.ts` runs on every request. It enforces three states:
1. Not authed → redirect to `/login`
2. Authed but onboarding incomplete → redirect to `/onboarding`
3. Authed + onboarded → allow through

Supabase auth uses `@supabase/ssr`. Two client factories:
- `lib/supabase/server.ts` — React `cache()`-wrapped, for Server Components and API routes
- `lib/supabase/client.ts` — browser client for Client Components
- `lib/supabase/admin.ts` — service role client used only in cron paths

All DB queries are scoped to `user.id` via RLS on every table.

### The Five Agents

Each agent is an API route that can be called on-demand (POST) or via Vercel cron. Cron routes are identified by the `x-vercel-cron: 1` header and use the admin client to iterate all users.

| Agent | Route | Trigger | Storage |
|-------|-------|---------|---------|
| **Luka** | `/api/luka` | Chat messages from client | — (stateless, uses session messages) |
| **Argus** | `/api/agents/argus` | Dashboard load + daily cron 8am | `alerts` table |
| **Solomon** | `/api/agents/solomon` | Sunday cron 9am + manual POST | `weekly_reports` table |
| **Silas** | `/api/agents/silas` | Sunday cron 9am + manual POST | `pulse_insights` table |
| **Kairos** | `/api/agents/kairos` | Luka `trigger_kairos` tool + event detection | `life_events` table; sets `kairos_pending` on `user_settings` |

**Luka** is the only agent users interact with directly. Its system prompt is built fresh on every call using live data: safe-to-spend, active Argus alerts, top Silas insights, latest Solomon word, and whether Kairos has a pending life-change review. It uses claude-sonnet-4-6.

**Kairos pending flow**: when `kairos_pending = true` in `user_settings`, Luka's system prompt instructs it to open with a plan review prompt. After the review, call `PATCH /api/agents/kairos` to clear the flag and set `last_plan_review`.

### Core Financial Logic

`lib/safe-to-spend.ts` — the single source of truth for the "Safe to Spend" number:
```
safeToSpend = liquidCash - billsDueSoon - emergencyBuffer - weeklyNeeds - giving - savings - trading
```
`billsDueSoon` = bills due before the next income date (not just 7 days). This calculation is called on dashboard load, in Luka's read_financial_summary tool, and in Argus checks — always pass the Supabase client and userId, never cache across users.

`lib/income.ts` — income date advancement. `advanceStaleIncomeDates()` is called on dashboard load to silently push past-due income dates forward before any UI renders.

`lib/format.ts` — `formatUSD()` and `formatDate()`. Use these everywhere for consistency. `formatDate()` returns human-readable strings: "Today", "Tomorrow", "in 3 days", "Apr 28".

`lib/stewardship.ts` — stewardship scoring rubric and `scoreStewardship()`. Solomon uses this to compute the weekly 1–10 score.

### Database Schema

9 migrations in `supabase/migrations/`. Key tables:
- `user_settings` — one row per user, holds all allocation rules (giving, savings, trading, needs budgets), `emergency_buffer`, `kairos_pending`, `last_plan_review`
- `income_sources` — has both `next_date` and `next_expected_date` columns (historical inconsistency). New code should update both when advancing dates.
- `bills` — `next_due_date` is the primary field. Advancing after payment is done locally (not via DB trigger).
- `alerts` — written by Argus. Has `agent`, `alert_type`, `is_read`, `severity`. Deduplicated by `alert_type` within 24h.
- `pulse_insights` — written by Silas. Dismissed per-row in DB (not localStorage).
- `weekly_reports` — one per user per `week_start` date. Upserted each Sunday.
- `life_events` — append-only log written by Kairos. Cleared via `acknowledged = true`.

RLS is enabled on all tables — every policy uses `auth.uid() = user_id`.

### UI Conventions

**Agent avatars**: `components/AgentAvatar.tsx` — use `agent="luka"|"solomon"|"argus"|"silas"|"kairos"`. Colors: Luka=purple, Solomon=amber, Argus=blue, Silas=teal, Kairos=green.

**Toast notifications**: wrap is in `ToastProvider` (already in layout). Use `const toast = useToast()` in any Client Component, then `toast("message")` for success or `toast("message", "error")`.

**Design tokens**: the app targets dark mode (zinc-900 cards, zinc-800 borders). CSS variables in `globals.css` support light/dark via `.dark` class toggle. When writing new UI, use Tailwind's `zinc-*` scale for backgrounds/borders and semantic colors (green for income, red for danger, amber for warnings, purple for primary/Luka).

**Page metadata**: all pages export `export const metadata: Metadata = { title: "Page Name" }`. The layout template produces `"Page Name — Steward Money"` in the browser tab.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV                   # "sandbox" | "development" | "production"
ANTHROPIC_API_KEY           # Used server-side only in agent routes
SUPABASE_SERVICE_ROLE_KEY   # Used only in lib/supabase/admin.ts (cron paths)
```

### Plaid Integration

Link flow: `PlaidLinkButton` → `/api/plaid/create-link-token` → Plaid Link → `/api/plaid/exchange-token` → `/api/plaid/sync`. Transactions sync via webhook at `/api/plaid/webhook` and are staged in `pending_transactions` before being written to `transactions`. Plaid connection metadata lives in `plaid_items`.

`PLAID_ENV=sandbox` during development — sandbox returns synthetic transactions that include unrealistic merchants; filter these out when displaying to users.

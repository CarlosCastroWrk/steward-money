# STATUS.md — Steward Money

_Last updated: 2026-05-11_

## Shipped 2026-05-11 — Phase 2: Luka Daily Insight (session 6)

New `luka_daily_insights` table (migrations 027 + 028). Luka now surfaces a daily 2-3 sentence observation on the home screen — observation + specific number + soft question. Not a report: an insight.

- **`lib/daily-insight.ts`** — owns all logic: `getActiveInsight`, `shouldRegenerate`, `detectCategoryJump`, `detectLargeTransaction`, `generateInsightIfNeeded`. Category-jump trigger (>20% WoW, ≥$50 floor). Large-transaction trigger (≥$200 in last 24h). 6h cooldown between trigger regenerations. 3/day hard cap. User timezone from `user_settings`, defaults to America/Chicago.
- **`app/api/luka/insight/route.ts`** — GET returns active insight. POST triggers generation; `force: true` bypasses checks (dev only, 403 in prod).
- **`components/dashboard/LukaDailyInsight.tsx`** — home screen card. Placeholder shown to new users.
- **`app/page.tsx`** — `generateInsightIfNeeded` added to `Promise.all`. Card renders between greeting and safe-to-spend.
- **Webhook** — after Plaid transaction sync, insight regeneration fires and-forget via admin client.
- **Debug** — `/debug/agents` shows active insight text + force-regenerate button (dev only).
- Model: `claude-sonnet-4-6`. tsc + build clean.
- **Pending**: run migration 028 in Supabase SQL editor before testing (user-level write policies).

## Shipped 2026-05-11 — Phase 1.5: Council Deleted (session 6)

Deleted the Council multi-agent deliberation feature entirely. Council was a separate page (`/council`) that convened silas, argus, eden, and nova — all archived agents — to answer a financial question. It was missed in Phase 1 because Phase 0 scoped only to the Pulse cards surface. Los's call: not on the keep list. Deleted `app/council/page.tsx`, `app/api/agents/council/route.ts`, `components/council/CouncilView.tsx`. Removed nav entry from Sidebar, More page, and BottomNav prefix list. Removed "The Council" quick action from `QuickActionRow`. Removed council rate limit from `lib/rate-limit.ts`. tsc + build clean.

## Shipped 2026-05-11 — Phase 1: Agent Consolidation (session 6)

The council is now five: **Luka, Solomon, Kairos, Iron, Echo**. Archived: Argus, Silas, Manna, Eden, Nova (routes kept, UI removed, crons removed).

Changes:
- **Pulse** — CouncilCards reduced to 5 agents. Agent detail page shows retirement message for archived agents. PulseView subtitle updated to "Your council."
- **Dashboard** — Argus alerts surface removed from `app/page.tsx`. No replacement.
- **Luka system prompt** — removed Argus alerts and Silas insights from live context. Now provides: safe-to-spend, Solomon's word, connected accounts, Kairos pending flag.
- **Echo migration** — deleted orphaned `/api/agents/echo/route.ts` (was CRUD for retired `echo_memories` table). Echo now routes through `/api/agents/chat` with `ECHO_SYSTEM_PROMPT_ADDITION` injected. Memory scope narrowed to `identity + relationships + patterns + preferences`.
- **Dead components deleted** — `SilasInsights.tsx`, `NovaMessage.tsx`, `MannaCard.tsx`, `EdenMoment.tsx`, `LukaMorningBriefing.tsx`, `SolomonWord.tsx`, `AgentChatModal.tsx`.
- **Registry cleanup** — Archived agent `AGENT_MEMORY_CATEGORIES` set to `[]`. Iron model fixed to `claude-sonnet-4-6` (was haiku). Iron greeting softened to "Let's stay on track."
- **Cron cleanup** — Removed Argus (daily 8am), Silas (Sunday 9am), Nova (daily 7am) from `vercel.json`.
- **CLAUDE.md** — Updated to reflect 5-agent architecture.
- TypeScript clean. Production build passes.

## Shipped 2026-05-09 (session 5)

- **Detail pass II** — all dark-mode hardcoded colors eliminated: `bg-zinc-*`, `bg-purple-*`, `bg-white text-black`, `bg-red-950`, `bg-blue-950`, `border-green-900` → CSS tokens throughout. 30 files changed. Covers: Luka.tsx (full purple→`--luka`), Toast, AccountCard type badges, TalkToLukaButton, LukaSetupMode, LukaVoiceMode, all modal submit buttons (Goals, Bills, Subscriptions, Transactions, Accounts, PlaidLinkButton), SessionGuard, AskLukaButton, Settings (SaveButton, IncomeSection), Pulse (PulseView subtitle added), SubscriptionsView status badges, login error box, onboarding Step2–8 + StepWrapper, CalendarOptInCard, TransactionsView (toast + Plaid banner).
- **Agent detail page fixed** — `/pulse/[agent_name]` changed from `height: 100dvh` inside scroll container to `fixed inset-0 z-[60]` overlay. Bottom nav no longer clips the chat. Loading skeleton shown while conversation history fetches.
- **Loading states** — added `loading.tsx` skeletons for: `/pulse`, `/merchant/[name]`, `/category/[name]`, `/more/calendar`. All use shimmer animation with proper CSS var borders/backgrounds.
- **Calendar tab** — `/more/calendar` with month grid + agenda views. Unified financial overlay: bills (red), income (green), Google Calendar events (purple), transactions, goal deadlines — all on one calendar. Day drawer slides up on tap showing items + net cash flow. Connect-calendar nudge if not linked. Added to More page navigation.
- **Notifications** — `lib/notifications.ts` helper for deduped alert writes from anywhere. Plaid sync error notifications: `ITEM_LOGIN_REQUIRED` → danger severity, others → warning (6h dedup, `PRODUCT_NOT_READY` suppressed). NotificationBell: all hardcoded colors → CSS variables.
- **Regression check** — `lib/safe-to-spend.ts` and `middleware.ts` untouched. All 22+ Luka tools intact (confirmed via grep). Cron auth pattern (`x-vercel-cron: 1`) intact across all 8 cron routes. Admin client used only in cron/webhook paths. TypeScript clean (`npx tsc --noEmit` exits 0).

## Shipped 2026-05-09 (session 4)

- **Reactive dashboard** — `app/page.tsx` marked `force-dynamic` so RSC re-runs on every request (prevents stale RSC cache after Luka mutations). `financials:changed` browser event dispatched after `data.refreshNeeded` in Luka.tsx, so ComingUpWidget reloads bills/goals without a full page refresh.
- **ComingUpWidget narrowed to 7 days** — removed income predictions (income_sources, variance detection). Widget now shows bills + goals + calendar events for the next 7 days only.
- **Instant Luka messages** — user message and loading indicator appear immediately on send, before `auth.getUser()` and `saveMsgToDB()` awaits. Perceived send latency eliminated.
- **Tab prefetch** — BottomNav calls `router.prefetch()` for all 4 primary routes on mount. Subsequent tab taps load from cache with near-zero latency.
- **CalendarCard collapse** — chevron toggle in header, collapses event list. State persisted to localStorage (`steward:calendarCollapsed`), default expanded.

## Shipped 2026-05-09 (session 3)

- **Plaid webhooks** — `/api/plaid/webhook` rebuilt with full JWT signature verification (jose library, Plaid-Verification header, request_body_sha256 body hash). Handles SYNC_UPDATES_AVAILABLE/DEFAULT_UPDATE (cursor-based transactionsSync), TRANSACTIONS_REMOVED (delete by plaid_transaction_id), ITEM_LOGIN_REQUIRED (sets needs_reauth=true). Unknown codes return 200. Added `needs_reauth` + `webhook_url` columns to plaid_items. `/api/plaid/setup-webhooks` one-time route registers existing items.
- **exchange-token uses transactionsSync** — new bank connections now set the cursor from day 1; subsequent syncs are truly incremental.
- **Auto-sync hook** — `hooks/useAutoSync.ts`: fires sync on mount (if >2 min stale), on visibilitychange (app resume), 2-min cooldown. Used in Dashboard, Activity, Accounts.
- **Live sync indicator** — `DashboardSyncButton` refactored: raw timestamp in, formats client-side with 60s ticker. States: Syncing spinner / amber stale warning / red error+retry / dim fresh label.
- **Bug 3 fix** — `delete_all_bills` Luka tool: deletes all bills in one atomic operation instead of 13 serial calls hitting the 6-iteration limit. Dashboard bill queries now filter `paid_at IS NULL` so auto-detected-paid bills don't inflate Monthly Expenses total.
- **Transaction sync cursor** — switched from `transactionsGet` (date range, re-fetches same window) to `transactionsSync` (cursor-based, only new transactions). Both manual sync and cron auto-sync updated.

## Shipped 2026-05-09 (session 2)

- **Plaid sync — dashboard Sync button** — "Synced X ago · Sync" was a nav link to /transactions; replaced with `DashboardSyncButton` client component that calls `POST /api/plaid/sync` inline and calls `router.refresh()` so balances update without leaving the page
- **Coming Up duplicates + variable income** — deleted 4 duplicate income_source rows (3× HEB, 2× BallerTV); added name-based dedup in ComingUpWidget; added variance detection against last 90 days of real paycheck transactions — if coefficient of variation > 15% across 3+ paychecks, specific dollar amount is suppressed and "earning" badge shows instead (HEB paychecks: $164–$250, CV=18%, now shows no amount)
- **Luka delete/update tools** — added `delete_bill`, `delete_income_source`, `delete_goal` (two-step confirmation enforced at tool level: `confirmed: false` previews, `confirmed: true` executes), plus `update_income_source` and `update_goal`; system prompt updated with confirmation requirement

## Shipped 2026-05-09 (session 1)

- **Framer Motion hydration flash fix** — SwipeableNavigator: added `mounted` state so Framer Motion transforms don't apply on first render, eliminating the ~1s layout flash on Dashboard
- **ComingUpWidget skeleton** — replaced `null` loading state with height-matched skeleton to prevent layout shift
- **iOS html overflow-x fix** — added `html { overflow-x: hidden }` to globals.css; iOS Safari ignores body-only overflow-x:hidden
- **TransactionsView select min-w-0** — native `<select>` wrappers in filter row now have `min-w-0` so they can't expand the flex container
- **Home tab horizontal overflow fix** — three-layer fix: ComingUpWidget sections got `min-w-0 max-w-full`; SwipeableNavigator grid got `width:100%` + `minWidth:0` on grid items; AppShell main switched from `overflow-x:hidden` to `overflow-x:clip` (avoids iOS Safari hidden+auto-scroll quirk)
- **Onboarding Plaid 405 fix** — middleware was 307-redirecting POST `/api/plaid/create-link-token` to the onboarding page (which 405s on POST); API routes now exempt from the onboarding redirect

## What's Working in Production

- **URL**: https://steward-money-w8m8.vercel.app
- All routes returning 200 — no 500s, no middleware failures
- Auth middleware functioning (routes protected, onboarding enforced)
- Dashboard, Transactions, Accounts, Pulse, Bills, Goals, Card, Settings — all loading
- Plaid sync (auto + manual)
- All 10 agents responding (Luka, Argus, Solomon, Silas, Kairos, Eden, Nova, Manna, Iron, Echo)
- Calendar sync (Google Calendar events loading)
- Realtime transaction subscription

## What's Broken

- **Google sign-in blocked** — Supabase correctly redirects to Google (302), but Google returns "access blocked" before auth completes. Root cause is at the **Google Cloud Console** level, not in the app code. Likely cause: the OAuth app is in "Testing" publishing status and/or `steward-money-w8m8.vercel.app` is not in the authorized redirect URIs / JavaScript origins.

## Most Recent Successful Deploy

- Deploy: `steward-money-w8m8-b02njb3dv-carloscastrowrk.vercel.app`
- Time: ~6 minutes ago (as of audit)
- Commit: `57679490` — "Fix dashboard layout flash and horizontal overflow"

## Env Vars Set on Production (carloscastrowrk/steward-money-w8m8)

| Variable | Status |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ Set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Set |
| PLAID_CLIENT_ID | ✅ Set |
| PLAID_SECRET | ✅ Set |
| PLAID_ENV | ✅ Set |
| ANTHROPIC_API_KEY | ✅ Set |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Set |
| NEXT_PUBLIC_APP_URL | ✅ Set |
| NEXT_PUBLIC_GOOGLE_CLIENT_ID | ✅ Set |
| GOOGLE_CLIENT_SECRET | ✅ Set |

All 10 required vars present. None missing.

## Features Live

- Safe to Spend calculation
- Bill tracking + autopay flags
- Income source tracking
- Goals tracking
- Plaid bank connectivity (production environment)
- Google Calendar sync (read-only)
- All 10 AI agents
- Luka chat with tool use (add bill, add goal, add income, update bill)
- Weekly Solomon report
- Argus alerts
- Silas pulse insights
- Kairos life event tracking
- Light/dark theme
- PWA manifest + icons

## Vercel Project State

- Local `.vercel/project.json` → `prj_gLuJtIWaJYc4dipU7JULB4Tb8zGJ` (steward-money-w8m8, carloscastrowrk)
- Previously linked to deleted team project (`tradefilmer100s-projects/steward-money`) — now resolved
- Git: clean (no uncommitted source changes)

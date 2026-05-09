# STATUS.md — Steward Money

_Last updated: 2026-05-09_

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

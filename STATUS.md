# STATUS.md — Steward Money

_Last updated: 2026-05-09_

## Shipped 2026-05-09

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

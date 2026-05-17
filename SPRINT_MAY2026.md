# StewardMoney — May 2026 Sprint

This is the active improvement plan from a full codebase audit completed May 17, 2026.
Work through these in order. Each task is self-contained.

---

## PHASE 1 — Cut the Dead Weight (do this first, no risk)

### Task 1 — Remove unused packages
- Remove `resend` from `package.json` (email feature scrapped May 2026, key already deleted)
- Remove `framer-motion` from `package.json` (not imported anywhere, ~30KB dead bundle weight)
- Run `npm install` after removal
- Run `npx tsc --noEmit` and `npm run build` to confirm clean

### Task 2 — Delete old onboarding v1
- Delete `app/onboarding/page.tsx` (the 10-step version)
- Delete all files in `components/onboarding/` (Step1Profile through Step10Finish)
- The new clean 3-step flow at `app/onboarding/v2/` is the only path — keep that untouched
- Confirm middleware still routes to the correct onboarding path after deletion

### Task 3 — Tombstone archived agent API routes
- Archived agents: Argus, Silas, Manna, Eden, Nova
- For each route in `app/api/agents/` belonging to these agents: replace the handler body with a 410 Gone response
- Pattern: `return NextResponse.json({ error: "This agent has been retired." }, { status: 410 })`
- Do NOT delete the route files — just gut them so accidental triggers can't burn AI credits
- Keep all their DB tables and data intact

### Task 4 — Extract duplicate toMonthly() function
- `toMonthly()` is copy-pasted in `app/page.tsx` and `app/bills/page.tsx`
- Move it to `lib/format.ts` as a named export
- Replace both usages with the import
- Run `npx tsc --noEmit` to confirm

### Task 5 — Remove AllocationCard dead code
- `components/dashboard/AllocationCard.tsx` is built but never rendered anywhere
- Two options: A) wire it into the dashboard (see Phase 3 Task 12), or B) delete it now and rebuild it in Phase 3
- Default: delete it now. It will be rebuilt properly in Phase 3 when we redesign the dashboard.

---

## PHASE 2 — Fix What's Broken

### Task 6 — Fix the notification bell (it's empty)
- `NotificationBell` was feeding from Argus alerts (now archived)
- Wire it to show Luka's daily insights and Solomon's weekly word instead
- Logic: bell shows a dot if today's Luka insight hasn't been "seen" OR if Solomon's weekly word is new (generated this week and not acknowledged)
- Add `insight_seen_at` or `solomon_seen_at` to `user_settings` to track acknowledgment
- Tapping the bell should mark it as seen and navigate to the relevant content

### Task 7 — Fix the Cash Flow tab AI call (fires on every tap, no cache)
- `CashFlowView` calls `/api/agents/solomon/strategy` every time the user taps the Cash Flow tab
- This fires a live Claude API call (claude-haiku) with no caching — costs money and is slow
- Fix: cache the response in state (or in a `useRef`) for the session. Only refetch if the user explicitly requests a refresh or if the last fetch was >4 hours ago.
- Add a subtle "Refresh" icon next to the strategy text so users can trigger it manually

### Task 8 — Reduce dashboard query count from 14 to ~8
- Open `app/page.tsx` and find the `Promise.all` block
- Combine `allBillsResult` and `upcomingBillsResult` into one query, filter client-side
- Replace `accountsCheckResult` (just checks if accounts exist) with a `.length` check on the accounts query that's already being fetched
- Combine any other overlapping queries
- Goal: 8 queries or fewer in the `Promise.all`
- Run `npm run build` and verify the dashboard still loads correctly

### Task 9 — Add sync status visibility
- If Plaid sync fails or is stale, the user currently sees nothing
- Add a sync status badge to the dashboard: green dot when fresh (synced < 2 hours ago), amber dot + "Tap to sync" when stale (> 6 hours) or errored
- The existing "Last synced X minutes ago" timestamp in the Safe-to-Spend card can stay — add the badge next to it or replace the timestamp with a colored dot + text

### Task 10 — Add debug page production guard
- `app/debug/agents/page.tsx` is accessible in production
- The API behind the force-regenerate button correctly returns 403 in prod, but the page itself loads
- Add a redirect at the top of the debug page: if `process.env.NODE_ENV !== 'development'`, redirect to `/`
- One line fix

---

## PHASE 3 — The One Dashboard Vision

This is the big one. Goal: one screen tells the whole financial story without requiring navigation.

### Task 11 — Add income panel to dashboard
- Currently there is zero income visibility on the home screen
- Add a compact income row between the greeting and the STS hero card (or inside the hero card)
- Show: "Next paycheck: [date formatted as 'in 3 days' or 'Tomorrow'] · $[amount]"
- Pull from `income_sources` where `is_primary = true` (or the highest-amount source if no primary flag)
- Use `lib/format.ts` formatDate() for the date string

### Task 12 — Add three hero numbers to the STS card
- The Safe-to-Spend card currently shows one number
- Add two companion numbers below or beside it:
  1. **Total Liquid Cash** — sum of `available_balance` across all depository accounts
  2. **Net Position** — Total Liquid Cash minus total debt (credit + loan `current_balance`)
- These numbers already exist in the accounts page calculation — extract the logic to `lib/safe-to-spend.ts` or a new `lib/accounts-summary.ts` helper
- Style: STS is the hero (large), the two companions are smaller below it, muted text color

### Task 13 — Flip the stats strip order
- Current order: Bills / Subscriptions / Goals / Spent
- New order: Spent This Month / Bills / Income Expected / Goals
- Show reality (what happened) before commitments (what's planned)
- "Income Expected" = sum of income sources expected this month

### Task 14 — Add Money Flow mini-chart to dashboard
- Two bars side by side: Income This Month (green) and Spent This Month (amber/red)
- Use Recharts BarChart — it's already installed
- Place it below the stats strip, above Recent Activity
- Height: ~80px, compact, no axes labels needed — just the two bars with dollar amounts as labels on top
- Data: income from `income_sources` (month-to-date received), spending from `transactions` (current calendar month, expenses only)

### Task 15 — Replace swipeable dashboard tabs with vertical scroll
- The current Overview / Cash Flow / Categories tab system requires horizontal swipes
- People scroll vertically through financial info, not swipe
- Replace the tab container with a single vertical stack:
  1. Luka daily insight card
  2. STS hero card (with companion numbers from Task 12)
  3. Income panel (Task 11)
  4. Stats strip (Task 13)
  5. Money Flow chart (Task 14)
  6. Recent Activity (last 5 transactions)
  7. Bills Due This Week
  8. Goals progress
  9. Category breakdown (top 5 categories, simple list with amounts)
- The Cash Flow tab content (Solomon strategy, spending velocity) moves to the `/pulse/solomon` page
- The Categories tab content moves to its own page or stays accessible via a "See all categories" link at the bottom of the category breakdown section

---

## PHASE 4 — Make Luka Actually Surface Herself

### Task 16 — Add tap-to-chat to Luka's daily insight card
- The insight card is currently read-only
- Add a "Talk to Luka about this →" link at the bottom of the insight card
- Tapping it opens the Luka chat with the insight text pre-loaded as the opening message context
- Implementation: pass `?context=[insight_text]` as a URL param to the Luka chat route, and read it in the Luka chat component to pre-fill or send as the first message

### Task 17 — Wire paycheck allocation card to appear after income posts
- `/api/agents/allocate` is a fully working endpoint
- After `runTransactionSync` detects a new income transaction (amount matches an income source within ±$50), set a flag `allocation_pending = true` in `user_settings`
- On dashboard load, if `allocation_pending = true`: render the AllocationCard (rebuild it cleanly — see Task 5) as a prominent card above Recent Activity
- After the user dismisses/acknowledges it: PATCH `allocation_pending = false`

### Task 18 — Surface Solomon's weekly word on the dashboard
- Solomon generates a weekly stewardship observation every Sunday
- Currently only Luka sees it (via system prompt injection) — the user never sees it directly
- Add a "Solomon's Word" card to the dashboard that appears Saturday through Monday
- Show the 2-3 sentence observation + the stewardship score (1–10)
- Pull from `weekly_reports` table: `SELECT * FROM weekly_reports WHERE user_id = ? ORDER BY week_start DESC LIMIT 1`
- Style: distinct from Luka's card — use Solomon's agent color (`--solomon`)

### Task 19 — Add memory page link to Luka chat header
- The memory page at `/more/memory` is valuable but nobody finds it
- Add a small "memories" icon/link in the Luka chat header (next to the agent name)
- On tap: navigate to `/more/memory`
- One line of UI change

### Task 20 — Surface voice mode during first Luka open
- `LukaVoiceMode.tsx` is built but undiscoverable
- On the user's first Luka conversation (check a `luka_first_open` flag in user_settings or localStorage): show a one-time tooltip or banner: "Tip: tap the mic icon to talk instead of type"
- Auto-dismiss after 5 seconds or on first message sent

---

## Sequence to Run This In Claude Code

Paste this as your opening prompt when you open Claude Code in the StewardMoney folder:

```
Read SPRINT_MAY2026.md. Start with Phase 1, Task 1. Complete each task fully — 
run `npx tsc --noEmit` after every task to confirm no TypeScript errors before moving on. 
After Phase 1 is done, commit with message "Phase 1 complete: dead code removal". 
Then move to Phase 2. Report after each task what was done and what's next.
Do not skip ahead or combine tasks. Surgical changes only.
```

---

*Audit performed May 17, 2026. All findings based on live codebase read at ~/Projects/StewardMoney/*

# App-Wide Audit

Last updated: 2026-05-05

---

## Dead Code

### Components never imported by any page

| File | Status |
|------|--------|
| `components/bills/BillsView.tsx` | Superseded by `ExpensesView.tsx`. Bills page uses ExpensesView. Safe to delete. |
| `components/bills/AddBillModal.tsx` | Only referenced by BillsView (dead). Safe to delete along with BillsView. |
| `components/dashboard/MonthlyOverview.tsx` | Never imported anywhere. Safe to delete. |
| `components/dashboard/BillsDueSoonSection.tsx` | Never imported anywhere. Safe to delete. |
| `components/subscriptions/SubscriptionsView.tsx` | Page now redirects to /bills. Dead. |
| `components/subscriptions/AddSubscriptionModal.tsx` | Same — dead with SubscriptionsView. |

### Duplicate onboarding

- `/app/onboarding/page.tsx` — original, uses multi-step flow
- `/app/onboarding/v2/page.tsx` — alternate version, sets `onboarding_version: "v2"` in DB

Middleware routes to `/onboarding` (not v2). The v2 page is reachable only via direct URL. Investigate which should be canonical and remove the other.

---

## Redundant Functionality

### Decide page vs Card page
- `/decide` (`DecideView`) — "Should I buy this?" flow with Luka AI advice
- `/card` (`DecisionHub`) — new purchase check with DB history and Luka integration

Both check whether you can afford a purchase. `DecideView` has richer UI; `DecisionHub` saves to DB. Consider merging these into a single "Decide" experience or removing one. Recommend: keep `/card` for the visual card + quick check; keep `/decide` for the full Luka-powered deeper analysis.

---

## Missing Features (non-obvious gaps)

### Transactions page — 1.3 investigation
The self-healing client-side fetch in TransactionsView fires when `initialTransactions.length === 0 && plaidConnected`. However if the server component returns empty because of a Vercel edge-cache hit on a fresh session, the self-heal kicks in correctly. Confirmed the underlying data is present in DB. Monitor for recurring empty-screen reports after the force-dynamic addition.

### `income_sources` column inconsistency
Both `next_date` and `next_expected_date` exist on income_sources. `CLAUDE.md` notes to update both when advancing dates, but `advanceStaleIncomeDates()` in `lib/income.ts` may only update one. Verify both columns are updated on date advancement to prevent stale displays.

### Accounts `purpose` column
Added in migration 014. No UI yet displays account purposes outside of the Luka setup conversation. Add purpose badges to the Accounts page (`components/accounts/AccountsView.tsx`) to surface what Luka saved.

### Personal rules — no UI
`personal_rules` table created in migration 014. Rules are saved via Luka's `save_personal_rule` tool. No page or settings section displays them yet. Add a "My Rules" section to the Settings Profile tab.

---

## Performance Issues

### Dashboard waterfall
`app/page.tsx` fires 13 parallel Supabase queries on load via `Promise.all`. This is good. But `advanceStaleIncomeDates()` runs serially before the parallel block — it updates the DB then the parallel queries run. This is correct order, not a problem.

### `force-dynamic` on transactions
`app/transactions/page.tsx` exports `force-dynamic`. This bypasses CDN caching entirely. The page loads fresh on every request. At scale, consider partial prerendering once transactions are more stable.

### MannaCard fetches on mount
`MannaCard` fires a client-side fetch to `/api/agents/manna` on every dashboard load. The manna route upserts a row per day — on repeated loads within the same day, it returns the cached `manna_daily` row (fast). But each dashboard visit triggers a round-trip. Consider bundling manna data into the dashboard's server-side queries.

---

## Security Notes

### Service role key exposure
`lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY`. Confirm this is only called from cron-identified paths (header `x-vercel-cron: 1`). Never expose this client-side.

### Plaid webhook — no signature verification
`/api/plaid/webhook` receives Plaid events without verifying the `Plaid-Verification` header. Anyone who knows the webhook URL could send fake events. Add Plaid webhook signature verification using `plaid.verifyWebhook()`.

---

## UX Gaps

- **No loading state** on the Accounts page when adding/removing Plaid connections — PlaidLinkButton succeeds silently with no visual feedback beyond toast.
- **Error states missing** on several agent cards in AgentsDebugView — if an agent API fails, the trigger button just stops spinning with no error message shown.
- **Subscriptions data in app/page.tsx** — dashboard still queries the `subscriptions` table for `monthlySubsTotal`. After the migration, subscriptions are in `bills` with `is_subscription = true`. Update the dashboard query to use bills + filter.

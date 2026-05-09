# E2E Tests — Steward Money

Playwright-based end-to-end tests against the live production app.

## Setup (one-time)

1. Create a **dedicated test account** — never use Carlos's real account.
   - Sign up at the live app (e.g. `stewardmoney.test@gmail.com`)
   - Connect a **Plaid Sandbox** bank account (not a real bank)
   - Complete onboarding so the dashboard loads

2. Fill in credentials:
   ```
   # .env.test.local
   TEST_USER_EMAIL=stewardmoney.test@gmail.com
   TEST_USER_PASSWORD=your-test-password
   ```

3. Done. Tests are ready to run.

## Running tests

```bash
# Headless (default) — fast, no browser window
npm run test:e2e

# Headed — watch the browser navigate in real time
npm run test:e2e:headed

# Interactive UI — step through tests visually
npm run test:e2e:ui

# Run against production (verify a deploy)
npm run verify:deploy

# Run a single file
npx playwright test tests/e2e/pulse.spec.ts

# Run a specific test by name
npx playwright test -g "10 agent cards are rendered"

# Run only mobile or desktop project
npx playwright test --project=mobile
npx playwright test --project=desktop
```

## Visual screenshots

`visual.spec.ts` takes full-page screenshots of every main page and saves them to:
```
tests/e2e/__screenshots__/
```

After a deploy, run visual tests and compare folders to catch regressions:
```bash
npx playwright test tests/e2e/visual.spec.ts --headed
```

Screenshots are named `mobile-dashboard-1234567890.png` (project + page + timestamp).

## Adding new tests

1. Create a file in `tests/e2e/` named `feature.spec.ts`
2. Import `ensureLoggedIn` from `./helpers/auth` to handle login
3. Follow the existing pattern: `test.describe` → `test.beforeEach` → individual `test` blocks
4. Keep tests focused on user-visible behavior, not implementation details

## Known limitations / skip patterns

- **Plaid OAuth connect flow** — can't be automated (requires OAuth popup). Skip tests that need fresh bank connection.
- **AI responses** — Luka/agent tests check that a response appears, not the exact content (responses vary).
- **Animations** — some tests add a `waitForTimeout(800)` to let animations settle before screenshots.
- **Flaky: auth redirect timing** — if the login redirect is slow, `waitForURL` may timeout. The 15s timeout handles most cases.

## Test account convention

- Always use `stewardmoney.test@gmail.com` (or equivalent) — a **dedicated** account
- Connect only Plaid Sandbox accounts to the test user
- Never run tests against Carlos's real account — financial data could be mutated
- The test account should have: Plaid Sandbox connected, bills set up, at least one goal

## After every significant ship

```bash
npm run verify:deploy
```

Report pass/fail. If tests fail, investigate before pushing additional changes.

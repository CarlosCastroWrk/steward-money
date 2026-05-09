import type { NextRequest } from "next/server";

/**
 * Verifies that a request comes from Vercel's cron scheduler.
 * Requires the x-vercel-cron header AND, if CRON_SECRET is set in env,
 * an Authorization: Bearer <secret> header.
 *
 * Set CRON_SECRET in Vercel environment variables to enforce the secret check.
 * Until it is set, the check logs a warning but allows through.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") !== "1") return false;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`;
  }

  // CRON_SECRET not configured — set it in Vercel env to enforce
  console.warn("[cron-auth] CRON_SECRET not set — anyone with x-vercel-cron header can trigger cron paths");
  return true;
}

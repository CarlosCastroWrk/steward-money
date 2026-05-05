// Simple sliding-window in-memory rate limiter.
// Works per serverless instance — good enough for a personal app.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const LIMITS: Record<string, { requests: number; windowMs: number }> = {
  "/api/luka":              { requests: 20, windowMs: 60_000 },
  "/api/agents/council":    { requests:  3, windowMs: 60_000 },
  "/api/agents":            { requests: 10, windowMs: 60_000 },
  "/api/calendar/sync":     { requests:  5, windowMs: 60_000 },
  "/api/plaid":             { requests: 10, windowMs: 60_000 },
};

function getLimitConfig(path: string) {
  if (path.startsWith("/api/agents/council")) return LIMITS["/api/agents/council"];
  if (path.startsWith("/api/agents"))         return LIMITS["/api/agents"];
  if (path.startsWith("/api/luka"))           return LIMITS["/api/luka"];
  if (path.startsWith("/api/calendar"))       return LIMITS["/api/calendar/sync"];
  if (path.startsWith("/api/plaid"))          return LIMITS["/api/plaid"];
  return null;
}

export function checkRateLimit(userId: string, path: string): { allowed: boolean; retryAfterMs?: number } {
  const config = getLimitConfig(path);
  if (!config) return { allowed: true };

  const key = `${userId}:${path}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (existing.count >= config.requests) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count++;
  return { allowed: true };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (now > win.resetAt) store.delete(key);
  }
}, 5 * 60_000);

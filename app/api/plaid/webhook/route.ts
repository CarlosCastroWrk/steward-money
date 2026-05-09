import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid";
import { cleanName, mapCategory, inferIsNeed } from "@/lib/plaid-utils";
import { importJWK, jwtVerify } from "jose";
import { createHash } from "crypto";

// Cache verification keys for up to 5 minutes to avoid calling Plaid on every webhook.
const keyCache = new Map<string, { key: Awaited<ReturnType<typeof importJWK>>; expiresAt: number }>();

async function getVerificationKey(kid: string) {
  const cached = keyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const jwk = res.data.key as unknown as Record<string, string | number>;
  const alg = String(jwk.alg ?? "ES256");
  const key = await importJWK(jwk as Parameters<typeof importJWK>[0], alg);
  // Respect Plaid's key expiry; cap at 5 minutes as a safety floor
  const expiredAt = typeof jwk.expired_at === "number" ? (jwk.expired_at as number) * 1000 : null;
  const ttl = expiredAt ? Math.min(expiredAt - Date.now(), 5 * 60 * 1000) : 5 * 60 * 1000;
  keyCache.set(kid, { key, expiresAt: Date.now() + Math.max(ttl, 0) });
  return key;
}

function decodeJwtHeader(token: string): Record<string, string> {
  const [headerB64] = token.split(".");
  return JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
}

async function verifyPlaidSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const jwt = req.headers.get("Plaid-Verification");
  if (!jwt) return false;

  try {
    const header = decodeJwtHeader(jwt);
    if (!header.kid) return false;

    const key = await getVerificationKey(header.kid);
    const { payload } = await jwtVerify(jwt, key);

    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    return (payload as { request_body_sha256?: string }).request_body_sha256 === bodyHash;
  } catch (err) {
    console.error("[webhook] JWT verification error:", err);
    return false;
  }
}

async function runTransactionSync(accessToken: string, itemDbId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: itemRow } = await supabase
    .from("plaid_items")
    .select("plaid_cursor")
    .eq("id", itemDbId)
    .maybeSingle();

  const { data: savedAccounts } = await supabase
    .from("accounts")
    .select("id, plaid_account_id")
    .eq("user_id", userId)
    .not("plaid_account_id", "is", null);

  const accountIdMap = Object.fromEntries(
    (savedAccounts ?? []).map((a: { plaid_account_id: string; id: string }) => [a.plaid_account_id, a.id])
  );

  let cursor: string | undefined = itemRow?.plaid_cursor ?? undefined;
  let hasMore = true;
  let addedCount = 0;
  let removedCount = 0;

  while (hasMore) {
    const txRes = await plaidClient.transactionsSync({ access_token: accessToken, cursor, count: 500 });
    const { added, modified, removed, next_cursor, has_more } = txRes.data;
    hasMore = has_more;

    const toUpsert = [...added, ...modified].map((tx) => {
      const cat = tx.personal_finance_category?.primary ?? (tx.category?.[0] ?? null);
      return {
        user_id: userId,
        account_id: accountIdMap[tx.account_id] ?? null,
        date: tx.date,
        merchant: cleanName(tx.merchant_name ?? tx.name),
        amount: -(tx.amount),
        category: mapCategory(cat),
        is_need: inferIsNeed(cat),
        is_manual: false,
        is_pending: tx.pending ?? false,
        plaid_transaction_id: tx.transaction_id,
      };
    });

    if (toUpsert.length > 0) {
      const posted  = toUpsert.filter((r) => !r.is_pending);
      const pending = toUpsert.filter((r) => r.is_pending);
      if (posted.length > 0) {
        await supabase.from("transactions").upsert(posted, { onConflict: "plaid_transaction_id", ignoreDuplicates: false });
      }
      if (pending.length > 0) {
        await supabase.from("transactions").upsert(pending, { onConflict: "plaid_transaction_id", ignoreDuplicates: true });
      }
      addedCount += added.length;
    }

    if (removed.length > 0) {
      const ids = removed.map((r) => r.transaction_id);
      await supabase.from("transactions").delete().in("plaid_transaction_id", ids).eq("user_id", userId);
      removedCount += removed.length;
    }

    cursor = next_cursor;
  }

  const now = new Date().toISOString();
  await supabase.from("plaid_items").update({ plaid_cursor: cursor }).eq("id", itemDbId);
  await supabase.from("accounts").update({ last_synced: now }).eq("user_id", userId).not("plaid_account_id", "is", null);

  console.log(`[webhook] sync done for item ${itemDbId}: added=${addedCount} removed=${removedCount}`);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = await verifyPlaidSignature(req, rawBody);
  if (!valid) {
    console.warn("[webhook] rejected: missing or invalid Plaid-Verification");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const webhookType = String(body.webhook_type ?? "");
  const webhookCode = String(body.webhook_code ?? "");
  const itemId      = String(body.item_id ?? "");

  console.log(`[webhook] ${webhookType}/${webhookCode} for item_id=${itemId}`);

  const supabase = createAdminClient();
  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, user_id, access_token, institution_name")
    .eq("item_id", itemId)
    .maybeSingle();

  if (!item) {
    // Unknown item_id — return 200 so Plaid doesn't retry endlessly
    console.warn(`[webhook] unknown item_id ${itemId}`);
    return NextResponse.json({ ok: true });
  }

  try {
    if (webhookType === "TRANSACTIONS") {
      if (webhookCode === "SYNC_UPDATES_AVAILABLE" || webhookCode === "DEFAULT_UPDATE" ||
          webhookCode === "INITIAL_UPDATE" || webhookCode === "HISTORICAL_UPDATE") {
        await runTransactionSync(item.access_token, item.id, item.user_id);
      } else if (webhookCode === "TRANSACTIONS_REMOVED") {
        const removedIds = (body.removed_transactions as string[] | undefined) ?? [];
        if (removedIds.length > 0) {
          await supabase.from("transactions").delete()
            .in("plaid_transaction_id", removedIds)
            .eq("user_id", item.user_id);
          console.log(`[webhook] TRANSACTIONS_REMOVED: deleted ${removedIds.length} rows`);
        }
      } else {
        console.log(`[webhook] unhandled TRANSACTIONS code: ${webhookCode}`);
      }
    } else if (webhookType === "ITEM") {
      const errCode = ((body.error ?? {}) as { error_code?: string }).error_code ?? "";
      if (webhookCode === "ERROR" && (errCode === "ITEM_LOGIN_REQUIRED" || errCode === "INVALID_CREDENTIALS")) {
        await supabase.from("plaid_items").update({ needs_reauth: true }).eq("id", item.id);
        console.warn(`[webhook] ITEM_LOGIN_REQUIRED for ${item.institution_name} — flagged for reauth`);
      } else {
        console.log(`[webhook] unhandled ITEM code: ${webhookCode}`);
      }
    } else {
      console.log(`[webhook] unhandled type: ${webhookType}/${webhookCode}`);
    }
  } catch (err) {
    console.error(`[webhook] error processing ${webhookType}/${webhookCode}:`, err);
    // Still return 200 — errors are our problem, not Plaid's, and retrying won't help
  }

  return NextResponse.json({ ok: true });
}

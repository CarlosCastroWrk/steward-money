import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plaidClient } from "@/lib/plaid";

// One-time migration: registers the webhook URL on all existing plaid_items.
// Call POST /api/plaid/setup-webhooks once after deploy.
// Requires SUPABASE_SERVICE_ROLE_KEY (uses admin client — no auth check needed since
// this only reads/updates plaid_items and calls Plaid's item update API).
export async function POST(req: NextRequest) {
  // Simple secret check — pass ?secret=PLAID_SECRET as a one-time guard
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!secret || secret !== process.env.PLAID_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
    : null;

  if (!webhookUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, item_id, access_token, institution_name");

  if (!items?.length) return NextResponse.json({ updated: 0, webhook_url: webhookUrl });

  const results: { institution: string; ok: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      await plaidClient.itemWebhookUpdate({
        access_token: item.access_token,
        webhook: webhookUrl,
      });
      await supabase.from("plaid_items").update({ webhook_url: webhookUrl }).eq("id", item.id);
      results.push({ institution: item.institution_name ?? item.id, ok: true });
      console.log(`[setup-webhooks] registered for ${item.institution_name}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message ?? String(err);
      results.push({ institution: item.institution_name ?? item.id, ok: false, error: msg });
      console.error(`[setup-webhooks] failed for ${item.institution_name}: ${msg}`);
    }
  }

  return NextResponse.json({ webhook_url: webhookUrl, results });
}

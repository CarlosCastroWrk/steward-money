import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { item_id } = await req.json();
  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  // Verify ownership and get access token
  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, access_token")
    .eq("item_id", item_id)
    .eq("user_id", user.id)
    .single();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get the Plaid account IDs for this item before revoking
  let plaidAccountIds: string[] = [];
  try {
    const accountsRes = await plaidClient.accountsGet({ access_token: item.access_token });
    plaidAccountIds = accountsRes.data.accounts.map((a) => a.account_id);
  } catch {
    // Item may already be in error state — proceed with local cleanup
  }

  // Revoke the access token on Plaid's side
  try {
    await plaidClient.itemRemove({ access_token: item.access_token });
  } catch {
    // Non-fatal — continue with DB cleanup
  }

  // Delete transactions and accounts linked to this item
  if (plaidAccountIds.length > 0) {
    const { data: accts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .in("plaid_account_id", plaidAccountIds);

    const acctIds = (accts ?? []).map((a) => a.id);
    if (acctIds.length > 0) {
      await supabase.from("transactions").delete().in("account_id", acctIds).eq("user_id", user.id);
    }

    await supabase
      .from("accounts")
      .delete()
      .eq("user_id", user.id)
      .in("plaid_account_id", plaidAccountIds);
  }

  // Delete the item record
  await supabase.from("plaid_items").delete().eq("id", item.id);

  return NextResponse.json({ success: true });
}

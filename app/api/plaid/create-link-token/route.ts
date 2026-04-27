import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
      : undefined;

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Steward Money",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      ...(webhookUrl ? { webhook: webhookUrl } : {}),
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown } };
    console.error("[plaid/create-link-token]", JSON.stringify(axiosErr?.response?.data ?? err));
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { plaidClient } from "@/lib/plaid";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: dbAccounts }, { data: items }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, institution, type, current_balance, available_balance, plaid_account_id, last_synced, is_active")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("plaid_items")
      .select("id, item_id, institution_name, access_token")
      .eq("user_id", user.id),
  ]);

  const plaidResults: {
    institution: string;
    accounts: {
      plaid_account_id: string;
      name: string;
      type: string;
      plaid_current: number | null;
      plaid_available: number | null;
      db_current: number | null;
      db_available: number | null;
      last_synced: string | null;
      discrepancy: boolean;
      error?: string;
    }[];
    error?: string;
  }[] = [];

  for (const item of items ?? []) {
    try {
      const res = await plaidClient.accountsGet({ access_token: item.access_token });
      const accounts = res.data.accounts.map((a) => {
        const db = (dbAccounts ?? []).find((d) => d.plaid_account_id === a.account_id);
        const plaidCurrent   = a.balances.current   ?? null;
        const plaidAvailable = a.balances.available ?? null;
        const dbCurrent      = db ? Number(db.current_balance) : null;
        const dbAvailable    = db ? (db.available_balance != null ? Number(db.available_balance) : null) : null;
        const useBalance     = plaidAvailable ?? plaidCurrent ?? 0;
        const storedBalance  = dbAvailable ?? dbCurrent ?? 0;
        return {
          plaid_account_id: a.account_id,
          name: a.name,
          type: `${a.type}/${a.subtype}`,
          plaid_current:   plaidCurrent,
          plaid_available: plaidAvailable,
          db_current:      dbCurrent,
          db_available:    dbAvailable,
          last_synced:     db?.last_synced ?? null,
          discrepancy:     Math.abs(useBalance - storedBalance) > 0.01,
        };
      });
      plaidResults.push({ institution: item.institution_name ?? item.id, accounts });
    } catch (err: unknown) {
      const plaidErr = err as { response?: { data?: { error_code?: string; error_message?: string } } };
      const code = plaidErr?.response?.data?.error_code ?? "UNKNOWN";
      const msg  = plaidErr?.response?.data?.error_message ?? String(err);
      plaidResults.push({
        institution: item.institution_name ?? item.id,
        accounts: [],
        error: `${code}: ${msg}`,
      });
    }
  }

  return NextResponse.json({
    db_accounts: dbAccounts ?? [],
    plaid_live: plaidResults,
    summary: {
      total_db_accounts: (dbAccounts ?? []).length,
      accounts_with_discrepancy: plaidResults.flatMap((r) => r.accounts).filter((a) => a.discrepancy).length,
      items_with_errors: plaidResults.filter((r) => r.error).length,
    },
  });
}

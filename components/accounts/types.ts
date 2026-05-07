export type PlaidItem = {
  id: string;
  item_id: string;
  institution_name: string | null;
  institution_id: string | null;
  created_at: string | null;
};

/** Row shape for `accounts` (matches Supabase schema after migrations). */
export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  /** Human-readable: "checking" | "savings" | "credit card" | "debt / installment" | "trading" */
  type: string;
  /** Raw Plaid type: "depository" | "credit" | "loan" | "investment" | "other" */
  plaid_type: string | null;
  /** Raw Plaid subtype: "checking" | "savings" | "credit card" | etc. */
  plaid_subtype: string | null;
  /** Present balance (what's owed for credit/loan; what's in account for depository) */
  current_balance: number | null;
  /** Available cash for depository accounts; NULL for credit/loan (available credit ≠ cash) */
  available_balance: number | null;
  /** Credit limit — only populated for credit accounts */
  credit_limit: number | null;
  is_manual: boolean | null;
  plaid_account_id: string | null;
  last_synced: string | null;
  is_active: boolean | null;
  created_at: string | null;
  notes?: string | null;
};

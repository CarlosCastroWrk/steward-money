/** Row shape for `accounts` (matches Supabase schema after migrations). */
export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  type: string;
  current_balance: number | null;
  available_balance: number | null;
  is_manual: boolean | null;
  plaid_account_id: string | null;
  last_synced: string | null;
  is_active: boolean | null;
  created_at: string | null;
  /** Present after `002_accounts_notes` migration. */
  notes?: string | null;
};

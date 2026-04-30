export type Transaction = {
  id: string;
  user_id: string;
  account_id: string | null;
  date: string;
  merchant: string | null;
  amount: number; // negative = expense, positive = income
  category: string | null;
  is_need: boolean | null;
  is_recurring: boolean | null;
  is_pending: boolean | null;
  notes: string | null;
  is_manual: boolean | null;
  plaid_transaction_id: string | null;
  created_at: string | null;
};

export type AccountOption = { id: string; name: string; type: string };

export const CATEGORIES = [
  "Food & Drink",
  "Shopping",
  "Transportation",
  "Bills & Utilities",
  "Entertainment",
  "Medical",
  "Personal Care",
  "Home",
  "Services",
  "Loan Payment",
  "Bank Fees",
  "Government",
  "Travel",
  "Transfer",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

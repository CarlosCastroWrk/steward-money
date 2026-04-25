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
  notes: string | null;
  is_manual: boolean | null;
  created_at: string | null;
};

export type AccountOption = { id: string; name: string; type: string };

export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transportation",
  "Gas",
  "Housing",
  "Utilities",
  "Entertainment",
  "Subscriptions",
  "Health & Fitness",
  "Shopping",
  "Personal Care",
  "Education",
  "Giving",
  "Transfer",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

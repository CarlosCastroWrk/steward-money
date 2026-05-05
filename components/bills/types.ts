export type Bill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_day: number | null;
  frequency: string;
  is_autopay: boolean | null;
  next_due_date: string | null;
  account_id: string | null;
  notes: string | null;
  category: string | null;
  created_at: string | null;
  paid_at: string | null;
  auto_detected_paid: boolean | null;
};

export type AccountOption = { id: string; name: string; type: string };

export type UpcomingExpense = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  expense_date: string;
  category: string | null;
  notes: string | null;
  is_saving: boolean;
  saved_amount: number;
  created_at: string | null;
  is_paid: boolean;
};

export type RecentTx = {
  id: string;
  merchant: string | null;
  amount: number;
  date: string;
  category: string | null;
};

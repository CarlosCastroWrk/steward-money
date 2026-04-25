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
  created_at: string | null;
};

export type AccountOption = { id: string; name: string; type: string };

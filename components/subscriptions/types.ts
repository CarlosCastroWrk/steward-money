export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  billing_day: number | null;
  category: string | null;
  status: "keep" | "cancel" | "evaluating";
  value_score: number | null;
  account_id: string | null;
  created_at: string | null;
};

export type AccountOption = { id: string; name: string; type: string };

export const SUB_CATEGORIES = [
  "Entertainment",
  "Music",
  "Software",
  "News & Media",
  "Health & Fitness",
  "Food & Delivery",
  "Education",
  "Cloud Storage",
  "Gaming",
  "Other",
] as const;

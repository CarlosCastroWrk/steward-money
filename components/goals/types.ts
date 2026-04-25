export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  priority: number | null;
  type: string | null;
  created_at: string | null;
};

export const GOAL_TYPES = ["savings", "emergency fund", "debt payoff", "investment", "purchase", "other"] as const;

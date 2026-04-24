export interface MockUser {
  name: string;
  currency: string;
  emergencyBuffer: number;
  savingsPct: number;
  givingPct: number;
  weeklyGroceriesMin: number;
  weeklyGasMin: number;
  nextPaycheckDate: string;
}

export interface MockAccount {
  id: string;
  name: string;
  institution: string;
  type: "checking" | "savings" | "credit";
  currentBalance: number;
  isManual: boolean;
}

export interface MockBill {
  id: string;
  name: string;
  amount: number;
  nextDueDate: string;
  isAutopay: boolean;
}

export interface MockGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}

export const MOCK_USER: MockUser = {
  name: "Jordan",
  currency: "USD",
  emergencyBuffer: 500,
  savingsPct: 10,
  givingPct: 10,
  weeklyGroceriesMin: 120,
  weeklyGasMin: 40,
  nextPaycheckDate: "2025-05-01"
};

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: "acct_checking_1",
    name: "Main Checking",
    institution: "Steward Credit Union",
    type: "checking",
    currentBalance: 2400,
    isManual: true
  },
  {
    id: "acct_savings_1",
    name: "Emergency Savings",
    institution: "Steward Credit Union",
    type: "savings",
    currentBalance: 1800,
    isManual: true
  },
  {
    id: "acct_credit_1",
    name: "Rewards Card",
    institution: "Northstar Bank",
    type: "credit",
    currentBalance: -340,
    isManual: true
  }
];

export const MOCK_BILLS: MockBill[] = [
  { id: "bill_rent", name: "Rent", amount: 850, nextDueDate: "2025-04-28", isAutopay: false },
  { id: "bill_phone", name: "Phone", amount: 65, nextDueDate: "2025-05-03", isAutopay: true },
  {
    id: "bill_internet",
    name: "Internet",
    amount: 55,
    nextDueDate: "2025-05-05",
    isAutopay: true
  },
  {
    id: "bill_spotify",
    name: "Spotify",
    amount: 11,
    nextDueDate: "2025-05-10",
    isAutopay: true
  }
];

export const MOCK_GOALS: MockGoal[] = [
  {
    id: "goal_emergency",
    name: "Emergency Fund",
    targetAmount: 2000,
    currentAmount: 500,
    deadline: "2025-12-31"
  },
  {
    id: "goal_move_out",
    name: "Move-Out Fund",
    targetAmount: 5000,
    currentAmount: 750,
    deadline: "2026-03-31"
  }
];

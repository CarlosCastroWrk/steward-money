export interface SafeToSpendResult {
  liquidTotal: number;
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  weeksUntilPaycheck: number;
  billsDueSoon: number;
  billsDueSoonList: Array<{
    id: string;
    name: string;
    amount: number;
    nextDueDate: string;
  }>;
  emergencyBuffer: number;
  weeklyNeedsTotal: number;
  givingDeducted: number;
  savingsDeducted: number;
  tradingDeducted: number;
  safeToSpend: number;
  safeToSpendRaw: number;
}

const ZERO_RESULT: SafeToSpendResult = {
  liquidTotal: 0,
  nextIncomeDate: null,
  nextIncomeAmount: 0,
  weeksUntilPaycheck: 1,
  billsDueSoon: 0,
  billsDueSoonList: [],
  emergencyBuffer: 0,
  weeklyNeedsTotal: 0,
  givingDeducted: 0,
  savingsDeducted: 0,
  tradingDeducted: 0,
  safeToSpend: 0,
  safeToSpendRaw: 0
};

export async function calculateSafeToSpend(
  supabase: any,
  userId: string
): Promise<SafeToSpendResult> {
  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings) return ZERO_RESULT;

  const [accountsResult, incomeResult, billsResult] = await Promise.all([
    supabase.from("accounts").select("type, current_balance").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("income_sources")
      .select("amount, next_expected_date, is_variable, hourly_rate, weekly_hours")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase.from("bills").select("id, name, amount, next_due_date").eq("user_id", userId)
  ]);

  const liquidTotal = (accountsResult.data ?? [])
    .filter((account: { type: string }) => ["checking", "savings"].includes(account.type))
    .reduce((sum: number, account: { current_balance: number | null }) => {
      return sum + Number(account.current_balance ?? 0);
    }, 0);

  const incomes = [...(incomeResult.data ?? [])].sort((a, b) => {
    return new Date(a.next_expected_date).getTime() - new Date(b.next_expected_date).getTime();
  });

  const nextIncome = incomes[0];
  const nextIncomeDate = nextIncome?.next_expected_date ?? null;
  const nextIncomeAmount = nextIncome
    ? nextIncome.is_variable
      ? Number(nextIncome.hourly_rate ?? 0) * Number(nextIncome.weekly_hours ?? 0)
      : Number(nextIncome.amount ?? 0)
    : 0;

  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const weeksUntilPaycheck = nextIncomeDate
    ? Math.max(1, Math.ceil((new Date(nextIncomeDate).getTime() - new Date().getTime()) / msPerWeek))
    : 1;

  const cutoffDate = nextIncomeDate
    ? new Date(nextIncomeDate)
    : new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7);

  const billsDueSoonList = (billsResult.data ?? [])
    .filter((bill: { next_due_date: string | null }) => {
      if (!bill.next_due_date) return false;
      return new Date(bill.next_due_date).getTime() <= cutoffDate.getTime();
    })
    .map((bill: { id: string; name: string; amount: number; next_due_date: string }) => ({
      id: bill.id,
      name: bill.name,
      amount: Number(bill.amount ?? 0),
      nextDueDate: bill.next_due_date
    }));

  const billsDueSoon = billsDueSoonList.reduce(
    (sum: number, bill: { amount: number }) => sum + bill.amount,
    0
  );

  const weeklyNeedsTotal =
    (Number(settings.weekly_groceries_min ?? 0) +
      Number(settings.weekly_gas_min ?? 0) +
      Number(settings.weekly_misc_cap ?? 0)) *
    weeksUntilPaycheck;

  let givingDeducted = 0;
  if (settings.giving_enabled) {
    if (settings.giving_type === "percentage") {
      givingDeducted = nextIncomeAmount * (Number(settings.giving_value ?? 0) / 100);
    } else if (settings.giving_type === "fixed") {
      givingDeducted = Number(settings.giving_value ?? 0);
    }
  }

  let savingsDeducted = 0;
  if (settings.savings_rule === "percentage") {
    savingsDeducted = nextIncomeAmount * (Number(settings.savings_value ?? 0) / 100);
  } else if (["fixed_paycheck", "fixed_per_paycheck"].includes(settings.savings_rule)) {
    savingsDeducted = Number(settings.savings_value ?? 0);
  } else if (["fixed_monthly", "fixed_per_month"].includes(settings.savings_rule)) {
    savingsDeducted = Number(settings.savings_value ?? 0) / 4;
  }

  let tradingDeducted = 0;
  if (settings.trading_rule === "percentage") {
    tradingDeducted = nextIncomeAmount * (Number(settings.trading_value ?? 0) / 100);
  } else if (["fixed_paycheck", "fixed_per_paycheck"].includes(settings.trading_rule)) {
    tradingDeducted = Number(settings.trading_value ?? 0);
  }

  const emergencyBuffer = Number(settings.emergency_buffer ?? 0);
  const safeToSpendRaw =
    liquidTotal -
    billsDueSoon -
    emergencyBuffer -
    weeklyNeedsTotal -
    givingDeducted -
    savingsDeducted -
    tradingDeducted;

  return {
    liquidTotal,
    nextIncomeDate,
    nextIncomeAmount,
    weeksUntilPaycheck,
    billsDueSoon,
    billsDueSoonList,
    emergencyBuffer,
    weeklyNeedsTotal,
    givingDeducted,
    savingsDeducted,
    tradingDeducted,
    safeToSpendRaw,
    safeToSpend: Math.max(0, safeToSpendRaw)
  };
}

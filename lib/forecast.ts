export type ForecastEvent = {
  type: "income" | "bill";
  name: string;
  amount: number; // positive = income, negative = bill
};

export type ForecastDay = {
  date: string; // YYYY-MM-DD
  events: ForecastEvent[];
  runningBalance: number;
  isBelowBuffer: boolean;
};

type IncomeSource = {
  name: string;
  amount: number;
  next_expected_date: string;
  frequency: string;
  is_recurring: boolean | null;
};

type BillSource = {
  name: string;
  amount: number;
  next_due_date: string | null;
  frequency: string;
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function advance(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T12:00:00");
  switch (freq) {
    case "weekly":
    case "variable": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "twice monthly":
    case "semi-monthly": d.setDate(d.getDate() + 15); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1); // monthly, etc.
  }
  return d.toISOString().split("T")[0];
}

export function buildForecast(
  startingBalance: number,
  buffer: number,
  incomeSources: IncomeSource[],
  bills: BillSource[],
  days = 60
): ForecastDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = today.toISOString().split("T")[0];
  const endDate = addDays(startDate, days);

  const eventMap = new Map<string, ForecastEvent[]>();

  const push = (date: string, event: ForecastEvent) => {
    if (!eventMap.has(date)) eventMap.set(date, []);
    eventMap.get(date)!.push(event);
  };

  for (const src of incomeSources) {
    let date = src.next_expected_date;
    let iters = 0;
    while (date <= endDate && iters < 200) {
      iters++;
      if (date >= startDate) {
        push(date, { type: "income", name: src.name, amount: Number(src.amount) });
      }
      if (!src.is_recurring) break;
      const next = advance(date, src.frequency);
      if (next === date) break;
      date = next;
    }
  }

  for (const bill of bills) {
    if (!bill.next_due_date) continue;
    let date = bill.next_due_date;
    let iters = 0;
    while (date <= endDate && iters < 200) {
      iters++;
      if (date >= startDate) {
        push(date, { type: "bill", name: bill.name, amount: -Number(bill.amount) });
      }
      const next = advance(date, bill.frequency);
      if (next === date) break;
      date = next;
    }
  }

  const result: ForecastDay[] = [];
  let running = startingBalance;

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const events = eventMap.get(date) ?? [];
    for (const ev of events) running += ev.amount;
    result.push({
      date,
      events,
      runningBalance: running,
      isBelowBuffer: running < buffer,
    });
  }

  return result;
}

type Bill = {
  id: string;
  name: string;
  amount: number;
  next_due_date: string | null;
  is_autopay: boolean;
};

const CIRCLE_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
];

function circleColor(name: string) {
  const hash = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return CIRCLE_COLORS[hash % CIRCLE_COLORS.length];
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function relativeDue(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

function dueColor(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff <= 1) return "text-red-400";
  if (diff <= 3) return "text-amber-400";
  return "text-[var(--text-3)]";
}

export function BillsDueSoonSection({ bills }: { bills: Bill[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Bills Due Soon</h2>
        <a href="/bills" className="text-xs text-emerald-400 transition-colors hover:text-emerald-300">
          See all
        </a>
      </div>

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--text-3)]">No bills due in the next 7 days</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--divider)]">
          {bills.map((bill) => (
            <div key={bill.id} className="flex items-center gap-3 px-4 py-3.5">
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${circleColor(bill.name)} text-sm font-semibold text-white`}
              >
                {bill.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-1)]">{bill.name}</p>
                <p className={`text-xs ${dueColor(bill.next_due_date!)}`}>{relativeDue(bill.next_due_date!)}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-[var(--text-1)]">{fmt(Number(bill.amount))}</p>
                {bill.is_autopay && (
                  <p className="text-[10px] text-emerald-400">Auto</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

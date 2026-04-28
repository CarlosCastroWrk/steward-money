function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function MonthlyOverview({
  income,
  expenses,
  bills,
}: {
  income: number;
  expenses: number;
  bills: number;
}) {
  const net = income - expenses - bills;

  const items = [
    { label: "Income", value: fmt(income), color: "text-emerald-400" },
    { label: "Expenses", value: fmt(expenses), color: "text-rose-400" },
    { label: "Bills", value: fmt(bills), color: "text-amber-400" },
    { label: "Net Flow", value: (net >= 0 ? "+" : "-") + fmt(Math.abs(net)), color: net >= 0 ? "text-emerald-400" : "text-red-400" },
  ];

  return (
    <section>
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9898a8]">Monthly Overview</h2>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {items.map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-[#ffffff08] bg-[#13131f] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#9898a8]">{label}</p>
            <p className={`mt-2 text-lg font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type CalEventRaw = {
  id: string;
  title: string | null;
  start_time: string;
  event_type: string | null;
  spending_estimate: number;
  user_confirmed: boolean;
  category: string | null;
  is_income_event: boolean;
};
type BillRaw = { id: string; name: string; amount: number; next_due_date: string };
type IncomeRaw = { id: string; name: string; amount: number; next_expected_date: string; frequency: string };
type TxRaw = { id: string; date: string; merchant: string | null; amount: number; category: string | null };
type GoalRaw = { id: string; name: string; target_amount: number; current_amount: number; deadline: string };

export type CalendarItem = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  sublabel?: string;
  amount?: number; // positive = income, negative = expense
  dot: "income" | "expense" | "bill" | "event" | "goal" | "tx-expense" | "tx-income";
  href?: string;
};

type View = "month" | "agenda";

interface Props {
  calendarConnected: boolean;
  calEvents: CalEventRaw[];
  bills: BillRaw[];
  incomeSources: IncomeRaw[];
  transactions: TxRaw[];
  goals: GoalRaw[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function formatDayHeading(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const t = today();
  if (dateStr === t) return "Today";
  const tom = new Date(new Date().getTime() + 86_400_000).toISOString().slice(0, 10);
  if (dateStr === tom) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function DOT_COLOR(dot: CalendarItem["dot"]): string {
  switch (dot) {
    case "income":    return "var(--color-income)";
    case "bill":      return "var(--color-danger)";
    case "expense":   return "var(--color-expense)";
    case "event":     return "var(--luka)";
    case "goal":      return "var(--accent)";
    case "tx-income": return "var(--color-income)";
    case "tx-expense":return "var(--color-danger)";
    default:          return "var(--text-3)";
  }
}

function DOT_LABEL(dot: CalendarItem["dot"]): string {
  switch (dot) {
    case "income":    return "Income";
    case "bill":      return "Bill";
    case "expense":   return "Event";
    case "event":     return "Event";
    case "goal":      return "Goal";
    case "tx-income": return "Income";
    case "tx-expense":return "Expense";
    default:          return "";
  }
}

// ── Build unified item list ──────────────────────────────────────────────────

function buildItems(
  calEvents: CalEventRaw[],
  bills: BillRaw[],
  incomeSources: IncomeRaw[],
  transactions: TxRaw[],
  goals: GoalRaw[],
): CalendarItem[] {
  const items: CalendarItem[] = [];

  // Google Calendar events
  for (const ev of calEvents) {
    const date = toDate(ev.start_time);
    const isExpense = ev.event_type === "expense" && ev.user_confirmed && ev.spending_estimate > 0;
    const isIncome = ev.is_income_event;
    const amount = isExpense ? -ev.spending_estimate : isIncome ? ev.spending_estimate : undefined;
    items.push({
      id: `cal-${ev.id}`,
      date,
      label: ev.title ?? "Event",
      sublabel: ev.category ?? undefined,
      amount,
      dot: isIncome ? "income" : ev.event_type === "expense" ? "expense" : "event",
    });
  }

  // Bills
  for (const bill of bills) {
    if (!bill.next_due_date) continue;
    items.push({
      id: `bill-${bill.id}`,
      date: bill.next_due_date,
      label: bill.name,
      sublabel: "Bill due",
      amount: -bill.amount,
      dot: "bill",
      href: "/bills",
    });
  }

  // Income sources
  for (const src of incomeSources) {
    if (!src.next_expected_date) continue;
    items.push({
      id: `income-${src.id}`,
      date: src.next_expected_date,
      label: src.name,
      sublabel: src.frequency,
      amount: src.amount,
      dot: "income",
      href: "/settings",
    });
  }

  // Transactions (past, grouped as single spend/income)
  for (const tx of transactions) {
    items.push({
      id: `tx-${tx.id}`,
      date: tx.date,
      label: tx.merchant ?? "Transaction",
      sublabel: tx.category ?? undefined,
      amount: tx.amount,
      dot: tx.amount < 0 ? "tx-expense" : "tx-income",
      href: tx.merchant ? `/merchant/${encodeURIComponent(tx.merchant)}` : "/transactions",
    });
  }

  // Goals (show on deadline date)
  for (const goal of goals) {
    if (!goal.deadline) continue;
    const progress = goal.current_amount / goal.target_amount;
    items.push({
      id: `goal-${goal.id}`,
      date: goal.deadline,
      label: goal.name,
      sublabel: `Goal · ${Math.round(progress * 100)}%`,
      amount: goal.target_amount - goal.current_amount,
      dot: "goal",
      href: "/goals",
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  year, month,
  itemsByDate,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  itemsByDate: Map<string, CalendarItem[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}) {
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const numDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const t = today();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-px">
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayItems = itemsByDate.get(dateStr) ?? [];
          const isToday = dateStr === t;
          const isSelected = dateStr === selectedDate;
          const isPast = dateStr < t;

          // Collect unique dot types (max 4)
          const dotTypes = [...new Set(dayItems.map((it) => it.dot))].slice(0, 4);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                isSelected
                  ? "bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/40"
                  : "hover:bg-[var(--bg-elevated)]"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? "bg-[var(--accent)] text-white font-semibold"
                    : isSelected
                    ? "text-[var(--accent)] font-semibold"
                    : isPast
                    ? "text-[var(--text-3)]"
                    : "text-[var(--text-1)]"
                }`}
              >
                {day}
              </span>
              <div className="flex gap-0.5">
                {dotTypes.map((dot, di) => (
                  <span
                    key={di}
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: DOT_COLOR(dot) }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Drawer ───────────────────────────────────────────────────────────────

function DayDrawer({
  date,
  items,
  onClose,
}: {
  date: string;
  items: CalendarItem[];
  onClose: () => void;
}) {
  const totalIn  = items.filter((i) => (i.amount ?? 0) > 0).reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalOut = items.filter((i) => (i.amount ?? 0) < 0).reduce((s, i) => s + Math.abs(i.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Drawer */}
      <div
        className="relative rounded-t-3xl border-t border-[var(--border)] bg-[var(--bg-card)] pb-[env(safe-area-inset-bottom)] max-h-[75dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[var(--border)]">
          <div>
            <p className="text-base font-semibold text-[var(--text-1)]">{formatDayHeading(date)}</p>
            {(totalIn > 0 || totalOut > 0) && (
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                {totalIn > 0 && <span className="text-[var(--color-income)]">+{formatUSD(totalIn)}</span>}
                {totalIn > 0 && totalOut > 0 && <span className="mx-1">·</span>}
                {totalOut > 0 && <span className="text-[var(--color-danger)]">−{formatUSD(totalOut)}</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1.5">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-3)]">Nothing scheduled</p>
          ) : (
            items.map((item) => {
              const content = (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: DOT_COLOR(item.dot) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-1)] truncate">{item.label}</p>
                    {item.sublabel && (
                      <p className="text-xs text-[var(--text-3)]">
                        {DOT_LABEL(item.dot)} {item.sublabel && `· ${item.sublabel}`}
                      </p>
                    )}
                  </div>
                  {item.amount !== undefined && (
                    <p
                      className="text-sm font-semibold flex-shrink-0"
                      style={{ color: item.amount >= 0 ? "var(--color-income)" : "var(--color-danger)" }}
                    >
                      {item.amount >= 0 ? "+" : "−"}{formatUSD(Math.abs(item.amount))}
                    </p>
                  )}
                </div>
              );

              return item.href ? (
                <a key={item.id} href={item.href}>{content}</a>
              ) : (
                <div key={item.id}>{content}</div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agenda View ──────────────────────────────────────────────────────────────

function AgendaView({
  itemsByDate,
  onSelectDate,
}: {
  itemsByDate: Map<string, CalendarItem[]>;
  onSelectDate: (d: string) => void;
}) {
  const t = today();
  const dates = [...itemsByDate.keys()].sort();
  const upcomingDates = dates.filter((d) => d >= t);

  if (upcomingDates.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--text-3)] text-sm">No upcoming events, bills, or income</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {upcomingDates.map((date) => {
        const items = itemsByDate.get(date) ?? [];
        const totalIn  = items.filter((i) => (i.amount ?? 0) > 0).reduce((s, i) => s + (i.amount ?? 0), 0);
        const totalOut = items.filter((i) => (i.amount ?? 0) < 0).reduce((s, i) => s + Math.abs(i.amount ?? 0), 0);

        return (
          <div key={date}>
            <button
              type="button"
              onClick={() => onSelectDate(date)}
              className="mb-1.5 flex w-full items-center justify-between px-1 text-left"
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${date === t ? "text-[var(--accent)]" : "text-[var(--text-3)]"}`}>
                {formatDayHeading(date)}
              </p>
              <span className="text-xs text-[var(--text-3)]">
                {totalIn > 0 && <span className="text-[var(--color-income)]">+{formatUSD(totalIn)}</span>}
                {totalIn > 0 && totalOut > 0 && " · "}
                {totalOut > 0 && <span className="text-[var(--color-danger)]">−{formatUSD(totalOut)}</span>}
              </span>
            </button>
            <div className="space-y-1">
              {items.map((item) => {
                const content = (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: DOT_COLOR(item.dot) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-1)] truncate">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-[11px] text-[var(--text-3)]">{DOT_LABEL(item.dot)} · {item.sublabel}</p>
                      )}
                    </div>
                    {item.amount !== undefined && (
                      <p
                        className="text-sm font-semibold flex-shrink-0"
                        style={{ color: item.amount >= 0 ? "var(--color-income)" : "var(--color-danger)" }}
                      >
                        {item.amount >= 0 ? "+" : "−"}{formatUSD(Math.abs(item.amount))}
                      </p>
                    )}
                  </div>
                );
                return item.href ? (
                  <a key={item.id} href={item.href}>{content}</a>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendar Legend ──────────────────────────────────────────────────────────

function Legend() {
  const items: [string, string][] = [
    ["Income", "var(--color-income)"],
    ["Bill due", "var(--color-danger)"],
    ["Calendar event", "var(--luka)"],
    ["Transaction", "var(--color-danger)"],
    ["Goal deadline", "var(--accent)"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
      {items.map(([label, color]) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[11px] text-[var(--text-3)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CalendarView({ calendarConnected, calEvents, bills, incomeSources, transactions, goals }: Props) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView]   = useState<View>("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const allItems = useMemo(
    () => buildItems(calEvents, bills, incomeSources, transactions, goals),
    [calEvents, bills, incomeSources, transactions, goals]
  );

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of allItems) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
    }
    return map;
  }, [allItems]);

  const selectedItems = selectedDate ? (itemsByDate.get(selectedDate) ?? []) : [];

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="min-h-screen p-4 md:p-8 pb-24">
      <div className="mx-auto w-full max-w-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-1)]">Calendar</h1>
            <p className="mt-0.5 text-sm text-[var(--text-3)]">Bills, income, and events at a glance</p>
          </div>
          {/* View toggle */}
          <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
            {(["month", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  view === v
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar not connected nudge */}
        {!calendarConnected && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-4 w-4 flex-shrink-0 mt-0.5 text-[var(--text-3)]">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-1)]">Connect Google Calendar</p>
              <p className="mt-0.5 text-xs text-[var(--text-3)]">See your events alongside bills and income for a full picture.</p>
            </div>
            <a href="/more/integrations" className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white flex-shrink-0">
              Connect
            </a>
          </div>
        )}

        {/* Month view */}
        {view === "month" && (
          <>
            {/* Month nav */}
            <div className="mb-4 flex items-center justify-between">
              <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-[var(--text-1)]">{MONTH_NAMES[month]} {year}</p>
              <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 mb-4">
              <MonthGrid
                year={year}
                month={month}
                itemsByDate={itemsByDate}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d === selectedDate ? null : d)}
              />
            </div>

            <Legend />

            {/* Upcoming items preview below month */}
            {(() => {
              const t = today();
              const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
              const upcomingInMonth = [...itemsByDate.entries()]
                .filter(([d]) => d >= t && d <= monthEnd)
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([, items]) => items)
                .filter((item) => item.dot !== "tx-expense" && item.dot !== "tx-income")
                .slice(0, 8);

              if (upcomingInMonth.length === 0) return null;
              return (
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Upcoming this month</p>
                  <div className="space-y-1.5">
                    {upcomingInMonth.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: DOT_COLOR(item.dot) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text-1)] truncate">{item.label}</p>
                          <p className="text-[11px] text-[var(--text-3)]">{formatDayHeading(item.date)} · {DOT_LABEL(item.dot)}</p>
                        </div>
                        {item.amount !== undefined && (
                          <p className="text-sm font-semibold flex-shrink-0" style={{ color: item.amount >= 0 ? "var(--color-income)" : "var(--color-danger)" }}>
                            {item.amount >= 0 ? "+" : "−"}{formatUSD(Math.abs(item.amount))}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Agenda view */}
        {view === "agenda" && (
          <AgendaView itemsByDate={itemsByDate} onSelectDate={(d) => { setView("month"); setSelectedDate(d); }} />
        )}
      </div>

      {/* Day drawer */}
      {selectedDate && (
        <DayDrawer
          date={selectedDate}
          items={selectedItems}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

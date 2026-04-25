"use client";

import type { ForecastDay } from "@/lib/forecast";

type Props = {
  days: ForecastDay[];
  buffer: number;
  startingBalance: number;
};

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(v);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split("T")[0];
}

export function ForecastView({ days, buffer, startingBalance }: Props) {
  // Summary stats
  const lowestDay = days.reduce((min, d) =>
    d.runningBalance < min.runningBalance ? d : min
  );
  const eventDays = days.filter((d) => d.events.length > 0 || isToday(d.date));
  const dangerDays = days.filter((d) => d.isBelowBuffer).length;

  const incomeEvents = days.flatMap((d) => d.events.filter((e) => e.type === "income"));
  const billEvents = days.flatMap((d) => d.events.filter((e) => e.type === "bill"));
  const totalIncoming = incomeEvents.reduce((s, e) => s + e.amount, 0);
  const totalOutgoing = billEvents.reduce((s, e) => s + Math.abs(e.amount), 0);

  return (
    <section className="min-h-screen p-8">
      <div className="mx-auto w-full max-w-4xl">
        <div>
          <h1 className="text-2xl font-medium text-white">Forecast</h1>
          <p className="mt-1 text-sm text-zinc-400">60-day cash flow projection based on your bills and income</p>
        </div>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Starting balance</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatUSD(startingBalance)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Income next 60d</p>
            <p className="mt-2 text-xl font-semibold text-emerald-400">{formatUSD(totalIncoming)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Bills next 60d</p>
            <p className="mt-2 text-xl font-semibold text-red-400">{formatUSD(totalOutgoing)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${dangerDays > 0 ? "border-amber-800 bg-amber-950/20" : "border-zinc-800 bg-zinc-900"}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Low-balance days
            </p>
            <p className={`mt-2 text-xl font-semibold ${dangerDays > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {dangerDays === 0 ? "None" : `${dangerDays} days`}
            </p>
          </div>
        </div>

        {dangerDays > 0 && (
          <div className="mt-4 rounded-lg border border-amber-900 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
            Projected balance drops below your {formatUSD(buffer)} buffer on {dangerDays} day
            {dangerDays !== 1 ? "s" : ""}. Lowest point:{" "}
            <span className="font-semibold">{formatUSD(lowestDay.runningBalance)}</span> on{" "}
            {formatDate(lowestDay.date)}.
          </div>
        )}

        {/* Timeline */}
        <div className="mt-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Timeline — days with events
          </h2>
          {eventDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
              <p className="text-zinc-500">
                No income or bills scheduled. Add bills and income sources in Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventDays.map((day) => {
                const today = isToday(day.date);
                return (
                  <div
                    key={day.date}
                    className={`rounded-xl border px-4 py-3 ${
                      day.isBelowBuffer
                        ? "border-red-900 bg-red-950/20"
                        : today
                        ? "border-zinc-600 bg-zinc-800"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-300">
                            {formatDate(day.date)}
                            {today && (
                              <span className="ml-2 rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                                today
                              </span>
                            )}
                          </p>
                          {day.events.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {day.events.map((ev, i) => (
                                <span
                                  key={i}
                                  className={`rounded-full px-2 py-0.5 text-xs ${
                                    ev.type === "income"
                                      ? "bg-emerald-900/50 text-emerald-300"
                                      : "bg-red-900/40 text-red-300"
                                  }`}
                                >
                                  {ev.type === "income" ? "+" : "-"}
                                  {formatUSD(Math.abs(ev.amount))} {ev.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            day.isBelowBuffer
                              ? "text-red-400"
                              : day.runningBalance < buffer * 1.5
                              ? "text-amber-400"
                              : "text-zinc-200"
                          }`}
                        >
                          {formatUSD(day.runningBalance)}
                        </p>
                        <p className="text-xs text-zinc-600">projected balance</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

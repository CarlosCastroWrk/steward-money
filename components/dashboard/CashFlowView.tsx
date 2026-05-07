"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface MonthlyBucket { label: string; income: number; expense: number; net: number }

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0.01);
  const range = max - min;
  const W = 240, H = 36;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = positive ? "#10b981" : "#f87171";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 36 }} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.abs(n));
}

export function CashFlowView() {
  const router = useRouter();
  const [buckets, setBuckets] = useState<MonthlyBucket[]>([]);
  const [topCategories, setTopCategories] = useState<Array<{ name: string; total: number }>>([]);
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

      const [txRes, insightRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("date, amount, category")
          .eq("user_id", user.id)
          .gte("date", sixMonthsAgoStr)
          .order("date", { ascending: true }),
        fetch("/api/agents/solomon/strategy").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      const transactions = txRes.data ?? [];

      // Group by month
      const monthMap = new Map<string, { income: number; expense: number }>();
      const catMap = new Map<string, number>();
      const now = new Date();
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      for (const tx of transactions) {
        const [year, month] = tx.date.split("-");
        const key = `${year}-${month}`;
        if (!monthMap.has(key)) monthMap.set(key, { income: 0, expense: 0 });
        const bucket = monthMap.get(key)!;
        if (tx.amount > 0) bucket.income += tx.amount;
        else bucket.expense += Math.abs(tx.amount);

        // Only current month categories
        if (key === thisMonthKey && tx.amount < 0 && tx.category) {
          catMap.set(tx.category, (catMap.get(tx.category) ?? 0) + Math.abs(tx.amount));
        }
      }

      // Build sorted bucket array
      const sorted = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, { income, expense }]) => {
          const [year, month] = key.split("-");
          const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "short" });
          return { label, income, expense, net: income - expense };
        });

      setBuckets(sorted);
      setTopCategories(
        [...catMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, total]) => ({ name, total }))
      );

      if (insightRes?.strategy) setInsight(insightRes.strategy);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 rounded-2xl bg-[var(--bg-elevated)]" />
        <div className="h-20 rounded-2xl bg-[var(--bg-elevated)]" />
        <div className="h-32 rounded-2xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  const thisMonth = buckets[buckets.length - 1];
  const lastMonth = buckets[buckets.length - 2];
  const netNow = thisMonth?.net ?? 0;
  const netLast = lastMonth?.net ?? 0;
  const netChange = lastMonth && lastMonth.net !== 0 ? ((netNow - netLast) / Math.abs(lastMonth.net)) * 100 : 0;
  const netSparkData = buckets.map((b) => b.net);
  const expenseNow = thisMonth?.expense ?? 0;
  const expenseLast = lastMonth?.expense ?? 0;
  const expenseChange = expenseLast > 0 ? ((expenseNow - expenseLast) / expenseLast) * 100 : 0;
  const expenseSparkData = buckets.map((b) => b.expense);
  const maxExpense = Math.max(...topCategories.map((c) => c.total), 0.01);

  return (
    <div className="space-y-4">
      {/* Net income card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Net Income · This Month</p>
        <p className={`mt-1.5 text-4xl font-bold ${netNow >= 0 ? "text-emerald-500" : "text-red-400"}`}>{netNow >= 0 ? "+" : "−"}{fmt(netNow)}</p>
        {lastMonth && (
          <p className={`mt-1 text-xs ${netChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {netChange >= 0 ? "↑" : "↓"} {Math.abs(netChange).toFixed(0)}% vs last month
          </p>
        )}
        <div className="mt-3 text-[var(--text-3)]">
          <Sparkline data={netSparkData} positive={netNow >= 0} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--text-3)]">
          {buckets.map((b) => <span key={b.label}>{b.label}</span>)}
        </div>
      </div>

      {/* Spend card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Spent · This Month</p>
        <p className="mt-1.5 text-4xl font-bold text-[var(--text-1)]">{fmt(expenseNow)}</p>
        {expenseLast > 0 && (
          <p className={`mt-1 text-xs ${expenseChange <= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {expenseChange <= 0 ? "↓" : "↑"} {Math.abs(expenseChange).toFixed(0)}% vs last month
          </p>
        )}
        <div className="mt-3 text-[var(--text-3)]">
          <Sparkline data={expenseSparkData} positive={false} />
        </div>

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4">
            {topCategories.map(({ name, total }) => {
              const pct = Math.round((total / maxExpense) * 100);
              const displayName = name.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => router.push(`/category/${encodeURIComponent(name)}`)}
                  className="w-full text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-2)]">{displayName}</span>
                    <span className="text-[var(--text-3)]">{fmt(total)}</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-[var(--bg-elevated)]">
                    <div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Solomon insight */}
      {insight && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 mb-2">Solomon</p>
          <p className="text-sm text-[var(--text-2)] leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCategory } from "@/lib/categoryNames";

const CATEGORY_EMOJI: Record<string, string> = {
  food_and_drink: "🍔", food_and_beverage: "🍔", restaurants: "🍽️", groceries: "🛒",
  general_merchandise: "🛍️", shopping: "🛍️", clothing_and_accessories: "👕", electronics: "💻",
  transportation: "🚗", gas_stations: "⛽", taxi: "🚕", public_transportation: "🚌",
  travel: "✈️", airlines: "✈️", hotels: "🏨",
  entertainment: "🎬", recreation: "🎮", health_fitness: "💪", medical: "💊",
  healthcare: "🏥", pharmacy: "💊", personal_care: "✂️",
  home_improvement: "🔨", rent_and_utilities: "🏠", utilities: "💡",
  phone: "📱", internet: "🌐", cable: "📺", streaming: "📺", subscription: "📦",
  education: "📚", loan_payments: "💳", credit_card_payment: "💳",
  insurance: "🛡️", taxes: "📋", charity: "❤️", giving: "❤️", tithe: "❤️",
  savings: "🏦", investment: "📈", atm: "🏧", other: "📌",
};

function getCategoryEmoji(raw: string): string {
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return CATEGORY_EMOJI[key] ?? "📌";
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function CategoriesView() {
  const router = useRouter();
  const [categories, setCategories] = useState<Array<{ name: string; total: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split("T")[0];

      const { data } = await supabase
        .from("transactions")
        .select("amount, category")
        .eq("user_id", user.id)
        .gte("date", monthStart)
        .lt("amount", 0);

      const catMap = new Map<string, { total: number; count: number }>();
      let total = 0;
      for (const tx of data ?? []) {
        const key = tx.category ?? "other";
        const existing = catMap.get(key) ?? { total: 0, count: 0 };
        catMap.set(key, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 });
        total += Math.abs(tx.amount);
      }

      setCategories(
        [...catMap.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([name, { total, count }]) => ({ name, total, count }))
      );
      setTotalSpent(total);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-[var(--bg-elevated)]" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
        <p className="text-sm text-[var(--text-3)]">No spending this month yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        Spending by category · This month
      </p>
      {categories.map(({ name, total, count }) => {
        const pct = totalSpent > 0 ? Math.round((total / totalSpent) * 100) : 0;
        const label = formatCategory(name);
        const emoji = getCategoryEmoji(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => router.push(`/category/${encodeURIComponent(name)}`)}
            className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 transition-all active:scale-[0.98] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg flex-shrink-0 w-7 text-center">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[var(--text-1)]">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-3)]">{count} tx</span>
                    <span className="text-sm font-semibold text-[var(--text-1)]">{fmt(total)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[var(--bg-elevated)]">
                    <div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-[var(--text-3)] flex-shrink-0 w-8 text-right">{pct}%</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

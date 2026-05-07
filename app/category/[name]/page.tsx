import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCategory } from "@/lib/categoryNames";
import { CategoryDetailClient } from "./CategoryDetailClient";

export const dynamic = "force-dynamic";

interface Props { params: { name: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = decodeURIComponent(params.name);
  return { title: formatCategory(cat) };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function CategoryDetailPage({ params }: Props) {
  const rawCategory = decodeURIComponent(params.name);
  const label = formatCategory(rawCategory);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split("T")[0];
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toISOString().split("T")[0];

  const [thisMonthRes, lastMonthRes, allTxRes] = await Promise.all([
    supabase.from("transactions").select("amount").eq("user_id", user.id).ilike("category", rawCategory).gte("date", monthStart).lt("amount", 0),
    supabase.from("transactions").select("amount").eq("user_id", user.id).ilike("category", rawCategory).gte("date", lastMonthStart).lt("date", monthStart).lt("amount", 0),
    supabase.from("transactions").select("id, date, merchant, amount, category, is_pending").eq("user_id", user.id).ilike("category", rawCategory).order("date", { ascending: false }),
  ]);

  const thisMonthTotal = (thisMonthRes.data ?? []).reduce((s, t) => s + Math.abs(t.amount), 0);
  const lastMonthTotal = (lastMonthRes.data ?? []).reduce((s, t) => s + Math.abs(t.amount), 0);
  const allTxs = allTxRes.data ?? [];
  const totalEver = allTxs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgTx = allTxs.length > 0 ? totalEver / allTxs.filter((t) => t.amount < 0).length : 0;
  const change = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

  // Top merchants in this category
  const merchantMap = new Map<string, number>();
  for (const tx of allTxs.filter((t) => t.amount < 0)) {
    const m = tx.merchant ?? "Unknown";
    merchantMap.set(m, (merchantMap.get(m) ?? 0) + Math.abs(tx.amount));
  }
  const topMerchants = [...merchantMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen px-4 pb-10 pt-5 md:px-8 md:pt-8">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Link href="/transactions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
          ← Activity
        </Link>

        {/* Header */}
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-1)]">{label}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-3)]">{allTxs.length} transactions total</p>
          </div>
          <a
            href={`/?luka=${encodeURIComponent(`What do you notice about my ${label} spending?`)}`}
            className="flex-shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity active:opacity-80"
          >
            Ask Luka
          </a>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "This month", value: fmt(thisMonthTotal) },
            { label: "Last month", value: fmt(lastMonthTotal) },
            { label: "Avg per tx", value: fmt(avgTx) },
            { label: "vs last month", value: lastMonthTotal > 0 ? `${change >= 0 ? "+" : ""}${change.toFixed(0)}%` : "—", color: change > 10 ? "text-red-400" : change < -10 ? "text-emerald-400" : "text-[var(--text-1)]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">{label}</p>
              <p className={`mt-1 text-lg font-semibold ${color ?? "text-[var(--text-1)]"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Top merchants */}
        {topMerchants.length > 0 && (
          <section className="mt-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Top merchants</p>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]">
              {topMerchants.map(([merchant, total]) => (
                <Link
                  key={merchant}
                  href={`/merchant/${encodeURIComponent(merchant)}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)]"
                >
                  <span className="text-sm text-[var(--text-1)]">{merchant}</span>
                  <span className="text-sm font-semibold text-[var(--text-3)]">{fmt(total)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Client: time filter + transaction list */}
        <CategoryDetailClient transactions={allTxs} categoryLabel={label} />
      </div>
    </div>
  );
}

import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MerchantDetailClient } from "./MerchantDetailClient";

export const dynamic = "force-dynamic";

interface Props { params: { name: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const merchant = decodeURIComponent(params.name);
  return { title: merchant };
}

export default async function MerchantDetailPage({ params }: Props) {
  const merchant = decodeURIComponent(params.name);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, date, amount, category, is_pending, account_id")
    .eq("user_id", user.id)
    .ilike("merchant", merchant)
    .order("date", { ascending: false });

  const txs = transactions ?? [];
  const expenses = txs.filter((t) => t.amount < 0);
  const totalSpent = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgAmount = expenses.length > 0 ? totalSpent / expenses.length : 0;

  // Date range for frequency calc
  const dates = txs.map((t) => new Date(t.date + "T12:00:00").getTime());
  const oldest = dates.length > 0 ? Math.min(...dates) : Date.now();
  const daySpan = Math.max(1, (Date.now() - oldest) / 86_400_000);
  const perWeek = expenses.length > 0 ? (expenses.length / daySpan) * 7 : 0;

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
            <h1 className="text-2xl font-semibold text-[var(--text-1)]">{merchant}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-3)]">{txs.length} transaction{txs.length !== 1 ? "s" : ""}</p>
          </div>
          <a
            href={`/?luka=${encodeURIComponent(`Tell me about my spending at ${merchant}`)}`}
            className="flex-shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity active:opacity-80"
          >
            Ask Luka
          </a>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total spent", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalSpent) },
            { label: "Per visit avg", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(avgAmount) },
            { label: "Visits", value: String(expenses.length) },
            { label: "Frequency", value: perWeek >= 1 ? `${perWeek.toFixed(1)}×/wk` : perWeek > 0 ? `${(perWeek * 4).toFixed(1)}×/mo` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">{label}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-1)]">{value}</p>
            </div>
          ))}
        </div>

        {/* Client portion: time filter tabs + transaction list */}
        <MerchantDetailClient transactions={txs} />
      </div>
    </div>
  );
}

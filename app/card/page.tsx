import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { VirtualCard } from "@/components/card/VirtualCard";
import { DecisionHub } from "@/components/card/DecisionHub";

export const metadata: Metadata = { title: "Card" };

export default async function CardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [safe, settings, decisionsRes] = await Promise.all([
    calculateSafeToSpend(supabase, user.id),
    supabase.from("user_settings").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("spending_decisions")
      .select("id, description, amount, verdict, reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const displayName = settings.data?.display_name ?? "there";

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-lg">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--text-1)]">Steward Card</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">Spend only what&apos;s been cleared.</p>
        </header>
        <VirtualCard
          safeToSpend={safe.safeToSpend}
          liquidTotal={safe.liquidTotal}
          emergencyBuffer={safe.emergencyBuffer}
          billsDueSoon={safe.billsDueSoon}
          givingDeducted={safe.givingDeducted}
          savingsDeducted={safe.savingsDeducted}
          tradingDeducted={safe.tradingDeducted}
          weeklyNeedsTotal={safe.weeklyNeedsTotal}
          displayName={displayName}
        />
        <DecisionHub
          safeToSpend={safe.safeToSpend}
          weeklyNeedsTotal={safe.weeklyNeedsTotal}
          recentDecisions={decisionsRes.data ?? []}
        />
      </div>
    </div>
  );
}

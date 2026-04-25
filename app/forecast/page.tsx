import { createClient } from "@/lib/supabase/server";
import { buildForecast } from "@/lib/forecast";
import { ForecastView } from "@/components/forecast/ForecastView";

export default async function ForecastPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [accountsRes, incomeRes, billsRes, settingsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("type, current_balance")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("income_sources")
      .select("name, amount, frequency, next_expected_date, is_recurring")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("bills")
      .select("name, amount, frequency, next_due_date")
      .eq("user_id", user.id),
    supabase
      .from("user_settings")
      .select("emergency_buffer")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const liquidBalance = (accountsRes.data ?? [])
    .filter((a) => ["checking", "savings"].includes(a.type))
    .reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

  const buffer = Number(settingsRes.data?.emergency_buffer ?? 0);

  const days = buildForecast(
    liquidBalance,
    buffer,
    incomeRes.data ?? [],
    billsRes.data ?? []
  );

  return (
    <ForecastView
      days={days}
      buffer={buffer}
      startingBalance={liquidBalance}
    />
  );
}

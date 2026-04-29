import { createClient } from "@/lib/supabase/server";
import { advanceStaleIncomeDates } from "@/lib/income";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  await advanceStaleIncomeDates(supabase, user.id);

  const [settingsResult, incomeResult, accountsResult, prioritiesResult] = await Promise.all([
    supabase
      .from("user_settings")
      .select("display_name, currency, life_stage, main_goal, giving_enabled, giving_type, giving_value, giving_protected, emergency_buffer, savings_rule, savings_value, trading_rule, trading_value, weekly_groceries_min, weekly_gas_min, weekly_eating_out_cap, weekly_misc_cap")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("income_sources")
      .select("id, name, amount, frequency, next_expected_date, is_recurring, is_active, is_variable, hourly_rate, weekly_hours")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("accounts")
      .select("id, name, institution, type, current_balance, is_manual, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("allocation_priorities")
      .select("id, category, rank")
      .eq("user_id", user.id)
      .order("rank", { ascending: true }),
  ]);

  return (
    <SettingsView
      settings={settingsResult.data ?? null}
      incomeSources={incomeResult.data ?? []}
      accounts={accountsResult.data ?? []}
      priorities={prioritiesResult.data ?? []}
    />
  );
}

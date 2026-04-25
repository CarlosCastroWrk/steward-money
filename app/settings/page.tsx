import { createClient } from "@/lib/supabase/server";
import { advanceStaleIncomeDates } from "@/lib/income";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { GivingSection } from "@/components/settings/GivingSection";
import { BufferSection } from "@/components/settings/BufferSection";
import { SavingsSection } from "@/components/settings/SavingsSection";
import { TradingSection } from "@/components/settings/TradingSection";
import { NeedsSection } from "@/components/settings/NeedsSection";
import { IncomeSection } from "@/components/settings/IncomeSection";
import { PrioritySection } from "@/components/settings/PrioritySection";
import { AccountsSection } from "@/components/settings/AccountsSection";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  await advanceStaleIncomeDates(supabase, user.id);

  const [settingsResult, incomeResult, accountsResult, prioritiesResult] = await Promise.all([
    supabase.from("user_settings").select("display_name, currency, life_stage, main_goal, giving_enabled, giving_type, giving_value, giving_protected, emergency_buffer, savings_rule, savings_value, trading_rule, trading_value, weekly_groceries_min, weekly_gas_min, weekly_eating_out_cap, weekly_misc_cap").eq("user_id", user.id).maybeSingle(),
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
      .order("rank", { ascending: true })
  ]);

  const settings = settingsResult.data ?? null;
  const incomeSources = incomeResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const priorities = prioritiesResult.data ?? [];

  return (
    <section className="min-h-screen bg-[var(--color-bg)] p-8 text-[var(--color-text-primary)]">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b border-[var(--color-border)] pb-6">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] [font-family:var(--font-display)]">
            Settings
          </h1>
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)] [font-family:var(--font-body)]">
            Edit your financial rules. Changes save immediately.
          </p>
        </header>

        <div className="pt-8">
          <ProfileSection initialData={settings} />
          <GivingSection initialData={settings} />
          <BufferSection initialData={settings} />
          <SavingsSection initialData={settings} />
          <TradingSection initialData={settings} />
          <NeedsSection initialData={settings} />
          <IncomeSection initialSources={incomeSources} />
          <PrioritySection initialPriorities={priorities} />
          <AccountsSection initialAccounts={accounts} />
        </div>
      </div>
    </section>
  );
}

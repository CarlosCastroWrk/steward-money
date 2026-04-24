import type { SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  data: JsonRecord
) {
  const payload = { user_id: userId, ...data };
  const { error } = await supabase.from("user_settings").upsert(payload, {
    onConflict: "user_id"
  });
  if (error) throw error;
}

export async function saveOnboardingStep(
  supabase: SupabaseClient,
  userId: string,
  step: number
) {
  const { error } = await supabase.from("onboarding_status").upsert(
    {
      user_id: userId,
      current_step: step
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function saveIncomeSources(
  supabase: SupabaseClient,
  userId: string,
  sources: Array<{
    name: string;
    amount: number;
    frequency: string;
    next_expected_date: string;
    is_recurring: boolean;
  }>
) {
  const rows = sources.map((source) => ({ ...source, user_id: userId }));
  const { error } = await supabase.from("income_sources").insert(rows);
  if (error) throw error;
}

export async function saveAccounts(
  supabase: SupabaseClient,
  userId: string,
  accounts: Array<{
    name: string;
    institution?: string;
    type: string;
    current_balance: number;
  }>
) {
  const rows = accounts.map((account) => ({
    ...account,
    is_manual: true,
    user_id: userId
  }));
  const { error } = await supabase.from("accounts").insert(rows);
  if (error) throw error;
}

export async function savePriorities(
  supabase: SupabaseClient,
  userId: string,
  priorities: string[]
) {
  const { error: deleteError } = await supabase
    .from("allocation_priorities")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  const rows = priorities.map((category, index) => ({
    user_id: userId,
    category,
    rank: index + 1
  }));

  const { error: insertError } = await supabase.from("allocation_priorities").insert(rows);
  if (insertError) throw insertError;
}

export async function completeOnboarding(supabase: SupabaseClient, userId: string) {
  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      onboarding_completed: true
    },
    { onConflict: "user_id" }
  );
  if (settingsError) throw settingsError;

  const { error: statusError } = await supabase.from("onboarding_status").upsert(
    {
      user_id: userId,
      is_complete: true,
      completed_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (statusError) throw statusError;
}

export async function getOnboardingState(supabase: SupabaseClient, userId: string) {
  const [{ data: settings, error: settingsError }, { data: onboarding, error: onboardingError }] =
    await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("onboarding_status").select("*").eq("user_id", userId).maybeSingle()
    ]);

  if (settingsError) throw settingsError;
  if (onboardingError) throw onboardingError;

  return {
    currentStep: onboarding?.current_step ?? 1,
    settings
  };
}

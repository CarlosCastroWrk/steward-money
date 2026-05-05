import { SupabaseClient } from "@supabase/supabase-js";

export interface SetupItem {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  path?: string;
}

export async function getProgressiveSetup(
  supabase: SupabaseClient,
  userId: string
): Promise<SetupItem[]> {
  const [settings, income, accounts, goals] = await Promise.all([
    supabase.from("user_settings").select("display_name, main_goal, giving_enabled, emergency_buffer, onboarding_version").eq("user_id", userId).maybeSingle(),
    supabase.from("income_sources").select("id").eq("user_id", userId).limit(1),
    supabase.from("accounts").select("id").eq("user_id", userId).limit(1),
    supabase.from("goals").select("id").eq("user_id", userId).limit(1),
  ]);

  const s = settings.data;

  return [
    {
      key: "profile",
      label: "Set your name",
      description: "Add your display name so Steward can greet you properly.",
      complete: !!s?.display_name?.trim(),
      path: "/settings",
    },
    {
      key: "goal",
      label: "Define your main goal",
      description: "What are you working toward financially?",
      complete: !!s?.main_goal?.trim(),
      path: "/settings",
    },
    {
      key: "income",
      label: "Add income source",
      description: "Tell Steward when and how much you get paid.",
      complete: (income.data?.length ?? 0) > 0,
      path: "/settings",
    },
    {
      key: "accounts",
      label: "Connect bank account",
      description: "Link your accounts so Steward can see your real balances.",
      complete: (accounts.data?.length ?? 0) > 0,
      path: "/accounts",
    },
    {
      key: "buffer",
      label: "Set emergency buffer",
      description: "How much cash do you want untouchable at all times?",
      complete: (s?.emergency_buffer ?? 0) > 0,
      path: "/settings",
    },
    {
      key: "goals_list",
      label: "Add a savings goal",
      description: "Create a specific goal with a target amount.",
      complete: (goals.data?.length ?? 0) > 0,
      path: "/goals",
    },
  ];
}

export async function getIncompleteSetup(
  supabase: SupabaseClient,
  userId: string
): Promise<SetupItem[]> {
  const items = await getProgressiveSetup(supabase, userId);
  return items.filter((i) => !i.complete);
}

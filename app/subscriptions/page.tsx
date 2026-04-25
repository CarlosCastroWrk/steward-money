import { createClient } from "@/lib/supabase/server";
import { SubscriptionsView } from "@/components/subscriptions/SubscriptionsView";

export default async function SubscriptionsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [subsRes, accountsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, user_id, name, amount, billing_day, category, status, value_score, account_id, created_at")
      .eq("user_id", user.id)
      .order("amount", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("user_id", user.id)
      .eq("is_active", true)
  ]);

  return (
    <SubscriptionsView
      subscriptions={subsRes.data ?? []}
      accounts={accountsRes.data ?? []}
    />
  );
}

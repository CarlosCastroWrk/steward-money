import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "@/components/goals/GoalsView";

export default async function GoalsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("goals")
    .select("id, user_id, name, target_amount, current_amount, deadline, priority, type, created_at")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  return <GoalsView goals={data ?? []} />;
}

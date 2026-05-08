import { Metadata } from "next";
export const metadata: Metadata = { title: "Goals" };
import { createClient } from "@/lib/supabase/server";
import { GoalsView } from "@/components/goals/GoalsView";
import { BackButton } from "@/components/BackButton";

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

  return (
    <>
      <div className="px-4 pt-4 md:px-8 md:pt-8"><BackButton /></div>
      <GoalsView goals={data ?? []} />
    </>
  );
}

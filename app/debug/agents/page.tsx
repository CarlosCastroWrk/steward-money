import { Metadata } from "next";
export const metadata: Metadata = { title: "Agent Control Room" };
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgentsDebugView } from "@/components/debug/AgentsDebugView";
import { getActiveInsight } from "@/lib/daily-insight";

export default async function AgentsDebugPage() {
  if (process.env.NODE_ENV !== "development") redirect("/");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memories } = await supabase
    .from("agent_memories")
    .select("agent, summary, importance, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Keep only the most recent entry per agent
  const seen = new Set<string>();
  const latestPerAgent = (memories ?? []).filter((m) => {
    if (seen.has(m.agent)) return false;
    seen.add(m.agent);
    return true;
  });

  const activeInsight = await getActiveInsight(supabase, user.id);

  return <AgentsDebugView memories={latestPerAgent} activeInsight={activeInsight} />;
}

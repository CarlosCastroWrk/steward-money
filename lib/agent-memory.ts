import { SupabaseClient } from "@supabase/supabase-js";

type AgentName = "luka" | "argus" | "solomon" | "silas" | "kairos" | "eden" | "iron" | "nova" | "echo" | "manna";

export async function saveAgentMemory(
  supabase: SupabaseClient,
  userId: string,
  agent: AgentName,
  summary: string,
  importance: number = 5
) {
  await supabase.from("agent_memories").insert({
    user_id: userId,
    agent,
    summary,
    importance: Math.min(10, Math.max(1, importance)),
  });
}

export async function readAgentMemories(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 10
) {
  const { data } = await supabase
    .from("agent_memories")
    .select("agent, summary, importance, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function summarizeAgentMemoriesForLuka(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const memories = await readAgentMemories(supabase, userId, 5);
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `[${m.agent.toUpperCase()}] ${m.summary}`);
  return `Recent agent observations:\n${lines.join("\n")}`;
}

import type { SupabaseClient } from "@supabase/supabase-js";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":       { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25  },
  "claude-haiku-4-5":        { input: 0.25,  output: 1.25  },
};

export async function logAgentUsage(
  supabase: SupabaseClient,
  userId: string,
  agentName: string,
  modelUsed: string,
  inputTokens: number,
  outputTokens: number,
) {
  const pricing = PRICING[modelUsed] ?? { input: 3.00, output: 15.00 };
  const cost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  await supabase.from("agent_usage").insert({
    user_id: userId,
    agent_name: agentName,
    model_used: modelUsed,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: cost,
  });
}

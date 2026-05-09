import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingEvents, formatCalendarContextForAgent } from "@/lib/calendar-context";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { AGENT_REGISTRY, AGENT_MEMORY_CATEGORIES, type AgentName } from "@/lib/agents/registry";
import { logAgentUsage } from "@/lib/agents/log-usage";
import {
  getRelevantMemories,
  searchMemories,
  saveMemory,
  updateMemory,
  deleteMemory,
  formatMemoriesForPrompt,
  MEMORY_TOOLS,
  MEMORY_SYSTEM_PROMPT_ADDITION,
  ECHO_SYSTEM_PROMPT_ADDITION,
} from "@/lib/memory";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agent, messages, context } = await req.json() as {
    agent: AgentName;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context?: string;
  };

  const config = AGENT_REGISTRY[agent];
  if (!config) return NextResponse.json({ error: "Unknown agent" }, { status: 400 });

  const allowedCategories = AGENT_MEMORY_CATEGORIES[agent];

  // Fetch memories + agent-specific context in parallel
  const [memories, kairosCal, kairosSafe] = await Promise.all([
    getRelevantMemories(supabase, user.id, allowedCategories),
    agent === "kairos" ? getUpcomingEvents(supabase, user.id, 30) : Promise.resolve(null),
    agent === "kairos" ? calculateSafeToSpend(supabase, user.id) : Promise.resolve(null),
  ]);

  const memoryBlock = formatMemoriesForPrompt(memories);

  // Build enriched context
  let enrichedContext = context ?? "";
  if (agent === "kairos" && kairosCal && kairosSafe) {
    const calCtx = formatCalendarContextForAgent(kairosCal);
    const finCtx = `Current financial position: Safe-to-spend $${kairosSafe.safeToSpend.toFixed(0)}, liquid cash $${kairosSafe.liquidTotal.toFixed(0)}.`;
    enrichedContext = [enrichedContext, calCtx, finCtx].filter(Boolean).join("\n\n");
  }

  // Build system prompt: base + memory injection + memory instructions + context
  const memoryInstruction = agent === "echo"
    ? MEMORY_SYSTEM_PROMPT_ADDITION + ECHO_SYSTEM_PROMPT_ADDITION
    : MEMORY_SYSTEM_PROMPT_ADDITION;

  const systemParts = [
    config.systemPrompt,
    memoryInstruction,
    memoryBlock,
    enrichedContext ? `Context for this conversation: ${enrichedContext}` : "",
  ].filter(Boolean);

  const systemPrompt = systemParts.join("\n\n");

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let reply = "";
  let totalInput = 0;
  let totalOutput = 0;
  const memoryActions: Array<{ type: "save" | "delete" | "update"; content?: string }> = [];

  // Simple tool-use loop (max 3 iterations — memory tools only)
  for (let i = 0; i < 3; i++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: MEMORY_TOOLS as Anthropic.Tool[],
      messages: anthropicMessages,
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    if (response.stop_reason === "end_turn") {
      reply = response.content.find((b) => b.type === "text")?.text ?? "";
      break;
    }

    if (response.stop_reason === "tool_use") {
      // Append assistant message with all content blocks
      anthropicMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = block.input as Record<string, unknown>;
        let result: unknown;

        switch (block.name) {
          case "save_memory": {
            const mem = await saveMemory(
              supabase,
              user.id,
              agent,
              (input.categories as string[]) as import("@/lib/memory").MemoryCategory[],
              String(input.content)
            );
            if (mem) memoryActions.push({ type: "save", content: String(input.content) });
            result = mem ? { success: true, memory_id: mem.id } : { error: "Failed to save memory" };
            break;
          }
          case "update_memory": {
            const ok = await updateMemory(supabase, user.id, String(input.memory_id), String(input.new_content));
            result = ok ? { success: true } : { error: "Failed to update memory" };
            break;
          }
          case "delete_memory": {
            const ok = await deleteMemory(supabase, user.id, String(input.memory_id));
            if (ok) memoryActions.push({ type: "delete" });
            result = ok ? { success: true } : { error: "Failed to delete memory" };
            break;
          }
          case "search_memories": {
            const found = await searchMemories(supabase, user.id, String(input.query));
            result = found.map((m) => ({ id: m.id, content: m.content, categories: m.categories, updated_at: m.updated_at }));
            break;
          }
          default:
            result = { error: "Unknown tool" };
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    reply = response.content.find((b) => b.type === "text")?.text ?? "";
    break;
  }

  // Persist conversation turn
  await supabase.from("agent_conversations").insert([
    { user_id: user.id, agent_name: agent, role: "user", content: messages[messages.length - 1]?.content ?? "" },
    { user_id: user.id, agent_name: agent, role: "assistant", content: reply },
  ]);

  await logAgentUsage(supabase, user.id, agent, config.model, totalInput, totalOutput);

  return NextResponse.json({ reply, memoryActions: memoryActions.length > 0 ? memoryActions : undefined });
}

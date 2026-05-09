import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryCategory = "identity" | "financial" | "faith" | "relationships" | "patterns" | "preferences";

export interface UserMemory {
  id: string;
  user_id: string;
  categories: MemoryCategory[];
  content: string;
  saved_by_agent: string;
  source_conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  "id, user_id, categories, content, saved_by_agent, source_conversation_id, created_at, updated_at";

export async function saveMemory(
  supabase: SupabaseClient,
  userId: string,
  agentName: string,
  categories: MemoryCategory[],
  content: string,
  sourceConversationId?: string | null
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("user_memories")
    .insert({
      user_id: userId,
      categories,
      content,
      saved_by_agent: agentName,
      source_conversation_id: sourceConversationId ?? null,
    })
    .select("id")
    .single();
  if (error) { console.error("[memory] saveMemory:", error.message); return null; }
  return data as { id: string };
}

export async function searchMemories(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  allowedCategories?: MemoryCategory[]
): Promise<UserMemory[]> {
  const base = supabase
    .from("user_memories")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .ilike("content", `%${query}%`)
    .order("updated_at", { ascending: false })
    .limit(20);
  const { data } = await (
    allowedCategories && allowedCategories.length > 0
      ? base.overlaps("categories", allowedCategories)
      : base
  );
  return (data ?? []) as UserMemory[];
}

export async function getRelevantMemories(
  supabase: SupabaseClient,
  userId: string,
  allowedCategories?: MemoryCategory[]
): Promise<UserMemory[]> {
  const base = supabase
    .from("user_memories")
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  const { data } = await (
    allowedCategories && allowedCategories.length > 0
      ? base.overlaps("categories", allowedCategories)
      : base
  );
  return (data ?? []) as UserMemory[];
}

export async function updateMemory(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string,
  newContent: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_memories")
    .update({ content: newContent })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) console.error("[memory] updateMemory:", error.message);
  return !error;
}

export async function deleteMemory(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_memories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", memoryId)
    .eq("user_id", userId);
  if (error) console.error("[memory] deleteMemory:", error.message);
  return !error;
}

export function formatMemoriesForPrompt(memories: UserMemory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map(
    (m) => `• [${m.categories.join(", ")}] ${m.content}`
  );
  return `What you remember about this user:\n${lines.join("\n")}`;
}

export const MEMORY_TOOLS = [
  {
    name: "save_memory",
    description:
      "Save something meaningful about the user for future conversations. Use when the user shares facts about their life, values, habits, or preferences they'd want you to remember.",
    input_schema: {
      type: "object" as const,
      properties: {
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: ["identity", "financial", "faith", "relationships", "patterns", "preferences"],
          },
          description: "1-2 most relevant categories for this memory",
        },
        content: {
          type: "string",
          description: "The memory, written as a fact about the user. E.g. 'Works hourly at H-E-B with variable paychecks.'",
        },
      },
      required: ["categories", "content"],
    },
  },
  {
    name: "update_memory",
    description: "Update an existing memory with corrected or more current information.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "ID of the memory to update" },
        new_content: { type: "string", description: "Replacement content for the memory" },
      },
      required: ["memory_id", "new_content"],
    },
  },
  {
    name: "delete_memory",
    description: "Soft-delete a memory the user wants forgotten.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: { type: "string", description: "ID of the memory to delete" },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "search_memories",
    description: "Search ALL of the user's memories by keyword. Use before update_memory or delete_memory to find the right ID. Searches across every category regardless of which agent saved it.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "1-3 word keyword to search in memory content. Use a SHORT, specific word from what the user said — NOT a full sentence. E.g. 'ballertv', 'honda', 'HEB', 'tithe'. Short keywords match better." },
      },
      required: ["query"],
    },
  },
];

export const MEMORY_SYSTEM_PROMPT_ADDITION = `
You have memory across conversations. When the user shares meaningful information about themselves — their job, income type, family situation, faith practices, recurring patterns, or communication preferences — call save_memory ONCE with all relevant categories as a single array. Never call save_memory more than once for the same piece of information. When you save, announce it briefly: "Got it, I'll remember [brief content]." No emoji.

Do NOT save: hypotheticals, venting, one-off questions, or anything ambiguous. When in doubt, don't save.

"Remember that..." = explicit save request. "Forget that..." or "forget about..." = call search_memories first, confirm the specific memory with the user, then call delete_memory.`;

export const ECHO_SYSTEM_PROMPT_ADDITION = `
You are the memory keeper. When the user opens a conversation and you have relevant memories, proactively surface one naturally — e.g., "A while back you mentioned wanting to [X] — how's that going?" Only do this when genuinely relevant; don't force it every turn.`;

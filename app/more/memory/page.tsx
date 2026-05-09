import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRelevantMemories } from "@/lib/memory";
import { MemoryView } from "@/components/memory/MemoryView";

export const metadata: Metadata = { title: "Memory" };

export default async function MemoryPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const memories = user ? await getRelevantMemories(supabase, user.id) : [];

  return <MemoryView initialMemories={memories} />;
}

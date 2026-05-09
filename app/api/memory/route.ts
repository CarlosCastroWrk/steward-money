import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRelevantMemories } from "@/lib/memory";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memories = await getRelevantMemories(supabase, user.id);
  return NextResponse.json({ memories });
}

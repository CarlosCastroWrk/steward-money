import { createClient } from "@/lib/supabase/server";
import { calculateSafeToSpend } from "@/lib/safe-to-spend";
import { DecideView } from "@/components/decide/DecideView";

export default async function DecidePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await calculateSafeToSpend(supabase, user.id);

  return <DecideView result={result} />;
}

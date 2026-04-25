export function advanceIncomeDate(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T12:00:00");
  switch (freq) {
    case "weekly":
    case "variable":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "twice monthly":
    case "semi-monthly":
      d.setDate(d.getDate() + 15);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}

export function advanceToFuture(dateStr: string, freq: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  let date = dateStr;
  let iters = 0;
  while (date < todayStr && iters < 200) {
    iters++;
    date = advanceIncomeDate(date, freq);
  }
  return date;
}

export async function advanceStaleIncomeDates(
  supabase: any,
  userId: string
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const { data } = await supabase
    .from("income_sources")
    .select("id, next_expected_date, frequency")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lt("next_expected_date", todayStr);

  if (!data || data.length === 0) return;

  await Promise.all(
    data.map((src: { id: string; next_expected_date: string; frequency: string }) =>
      supabase
        .from("income_sources")
        .update({ next_expected_date: advanceToFuture(src.next_expected_date, src.frequency) })
        .eq("id", src.id)
    )
  );
}

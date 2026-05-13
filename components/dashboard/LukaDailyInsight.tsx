import type { LukaInsight } from "@/lib/daily-insight";

function LukaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LukaDailyInsight({ insight }: { insight: LukaInsight | null }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[var(--luka)]">
          <LukaIcon />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Luka
        </span>
        {insight && (
          <span className="ml-auto text-[10px] text-[var(--text-3)]">
            {timeAgo(insight.generated_at)}
          </span>
        )}
      </div>

      {insight ? (
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {insight.insight_text}
        </p>
      ) : (
        <p className="text-sm italic leading-relaxed text-[var(--text-3)]">
          Luka is still getting to know your patterns. Check back tomorrow.
        </p>
      )}
    </div>
  );
}

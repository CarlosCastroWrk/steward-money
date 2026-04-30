import Link from "next/link";

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const ACTIONS = [
  { lines: ["Add", "Transaction"], href: "/transactions", Icon: PlusIcon, ring: "text-emerald-400" },
  { lines: ["Add", "Bill"], href: "/bills", Icon: ReceiptIcon, ring: "text-violet-400" },
  { lines: ["Add", "Goal"], href: "/goals", Icon: FlagIcon, ring: "text-blue-400" },
  { lines: ["Accounts", ""], href: "/accounts", Icon: CardIcon, ring: "text-amber-400" },
  { lines: ["Before I", "Spend"], href: "/decide", Icon: ShieldIcon, ring: "text-rose-400" },
];

export function QuickActionRow() {
  return (
    <div className="flex justify-between gap-1">
      {ACTIONS.map(({ lines, href, Icon, ring }) => (
        <Link key={href} href={href} className="flex flex-1 flex-col items-center gap-2 rounded-xl p-1 transition-opacity active:opacity-60">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] ${ring}`}>
            <Icon />
          </div>
          <div className="text-center">
            {lines.map((line, i) => line ? (
              <p key={i} className="text-[10px] leading-tight text-[var(--text-3)]">{line}</p>
            ) : null)}
          </div>
        </Link>
      ))}
    </div>
  );
}

"use client";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h <= 11) return "Good morning";
  if (h >= 12 && h <= 16) return "Good afternoon";
  if (h >= 17 && h <= 20) return "Good evening";
  return "Hey";
}

function getLocalDate() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function GreetingHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-3)]">
          {getLocalDate()}
        </p>
        <h1 className="mt-0.5 text-2xl font-medium text-[var(--text-1)]">
          {getGreeting()},{" "}
          <span className="font-[family-name:var(--font-display)] italic">{displayName}</span>.
        </h1>
      </div>
    </header>
  );
}

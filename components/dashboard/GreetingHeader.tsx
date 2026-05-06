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
    <header>
      <h1 className="text-2xl font-semibold text-[var(--text-1)]">
        {getGreeting()}, {displayName}.
      </h1>
      <p className="mt-0.5 text-sm text-[var(--text-3)]">{getLocalDate()}</p>
    </header>
  );
}

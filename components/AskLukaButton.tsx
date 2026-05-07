"use client";

interface Props {
  prefill: string;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function AskLukaButton({ prefill, label = "Ask Luka", variant = "secondary", className = "" }: Props) {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("luka:open", { detail: { prefill } }));
  }

  const base = "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition";
  const styles = variant === "primary"
    ? `${base} bg-[var(--accent)] text-white hover:opacity-90`
    : `${base} border border-purple-700/40 bg-purple-900/20 text-purple-400 hover:bg-purple-900/30`;

  return (
    <button type="button" onClick={handleClick} className={`${styles} ${className}`}>
      {/* Luka sparkle avatar */}
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">✦</span>
      {label}
    </button>
  );
}

"use client";

interface Props {
  context: string;
}

export function LukaContextLink({ context }: Props) {
  function open() {
    window.dispatchEvent(
      new CustomEvent("luka:open", { detail: { prefill: context } })
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="mt-3 text-xs text-[var(--luka)] hover:opacity-80 transition-opacity"
    >
      Talk to Luka about this →
    </button>
  );
}

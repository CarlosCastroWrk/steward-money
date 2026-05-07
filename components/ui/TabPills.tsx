"use client";

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabPills({ tabs, active, onChange, className = "" }: Props) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto pb-0.5 ${className}`} style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all active:scale-95 ${
            tab.id === active
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "bg-[var(--bg-elevated)] text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

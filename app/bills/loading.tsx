function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export default function ExpensesLoading() {
  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-4 md:px-8">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <div className="space-y-1.5">
            <Bone className="h-5 w-24" />
            <Bone className="h-3 w-40" />
          </div>
          <Bone className="h-9 w-9 !rounded-xl" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 py-4 space-y-4 md:px-8">
        {/* Summary card */}
        <Bone className="h-32 w-full !rounded-2xl" />

        {/* Tab bar */}
        <Bone className="h-8 w-56" />

        {/* Expense cards */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
              <Bone className="h-9 w-9 !rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3 w-24" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Bone className="h-4 w-16" />
                <Bone className="h-6 w-20 !rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

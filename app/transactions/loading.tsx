function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function TransactionsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <Bone className="h-7 w-36" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 space-y-1.5">
            <Bone className="h-2.5 w-14" />
            <Bone className="h-5 w-20" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-8 w-24 flex-shrink-0" />
        ))}
      </div>

      {/* Transaction rows grouped by date */}
      {[1, 2].map((group) => (
        <div key={group} className="space-y-1">
          <Bone className="h-3 w-24 mb-2" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3 py-3">
              <div className="flex items-center gap-3">
                <Bone className="h-9 w-9 !rounded-full" />
                <div className="space-y-1.5">
                  <Bone className="h-3.5 w-32" />
                  <Bone className="h-3 w-20" />
                </div>
              </div>
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

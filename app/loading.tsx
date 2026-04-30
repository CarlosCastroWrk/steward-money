function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:space-y-6 md:px-8 md:pt-8">
      {/* Greeting */}
      <div className="space-y-1.5">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-36" />
      </div>

      {/* Today's Brief */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
        <Bone className="mb-3 h-2.5 w-20" />
        <div className="flex items-center divide-x divide-[var(--border)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex-1 space-y-1.5 ${i === 1 ? "pr-4" : i === 2 ? "px-4" : "pl-4"}`}>
              <Bone className="h-2.5 w-16" />
              <Bone className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* STS Hero */}
      <div className="rounded-2xl bg-[var(--bg-elevated)] p-6">
        <Bone className="mb-2 h-2.5 w-24" />
        <Bone className="mb-2 h-12 w-40" />
        <Bone className="mb-4 h-3 w-48" />
        <div className="flex gap-6 border-t border-[var(--border)] pt-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-2.5 w-14" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Bone key={i} className="h-9 flex-1" />
        ))}
      </div>

      {/* Monthly Overview */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <Bone className="mb-3 h-2.5 w-28" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-2.5 w-14" />
              <Bone className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Bills Due Soon */}
      <div className="space-y-2">
        <Bone className="h-2.5 w-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <div className="space-y-1.5">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-3 w-20" />
            </div>
            <Bone className="h-4 w-14" />
          </div>
        ))}
      </div>

      {/* Goals */}
      <div className="space-y-2">
        <Bone className="h-2.5 w-16" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--divider)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-4 space-y-2">
              <div className="flex justify-between">
                <Bone className="h-3.5 w-36" />
                <Bone className="h-3.5 w-8" />
              </div>
              <Bone className="h-3 w-28" />
              <div className="h-1 w-full rounded-full bg-[var(--bg-elevated)]">
                <div className="h-1 rounded-full bg-[var(--bg-card)]" style={{ width: `${30 + i * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

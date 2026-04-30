function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function GoalsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-24" />
        <Bone className="h-8 w-28" />
      </div>

      {/* Goals list */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-40" />
              <Bone className="h-4 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Bone className="h-3 w-28" />
              <Bone className="h-3 w-20" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

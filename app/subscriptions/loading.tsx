function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function SubscriptionsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-32" />
        <Bone className="h-8 w-28" />
      </div>

      {/* Total card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <Bone className="h-2.5 w-28" />
          <Bone className="h-5 w-20" />
        </div>
      </div>

      {/* Subscription rows */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
            <div className="flex items-center gap-3">
              <Bone className="h-9 w-9 !rounded-xl" />
              <div className="space-y-1.5">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bone className="h-5 w-12 !rounded-full" />
              <Bone className="h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

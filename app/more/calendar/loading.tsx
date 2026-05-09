function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export default function CalendarLoading() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-1.5">
            <Bone className="h-7 w-28" />
            <Bone className="h-3.5 w-48" />
          </div>
          <Bone className="h-8 w-36 !rounded-xl" />
        </div>

        {/* Month nav */}
        <div className="mb-4 flex items-center justify-between">
          <Bone className="h-8 w-8 !rounded-lg" />
          <Bone className="h-4 w-32" />
          <Bone className="h-8 w-8 !rounded-lg" />
        </div>

        {/* Calendar grid */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 mb-4">
          <div className="grid grid-cols-7 gap-y-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 py-1.5">
                <Bone className="h-6 w-6 !rounded-full" />
                <div className="flex gap-0.5">
                  {i % 3 === 0 && <Bone className="h-1 w-1 !rounded-full" />}
                  {i % 5 === 0 && <Bone className="h-1 w-1 !rounded-full" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming preview */}
        <div className="mt-6 space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
              <Bone className="h-2 w-2 !rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3 w-24" />
              </div>
              <Bone className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

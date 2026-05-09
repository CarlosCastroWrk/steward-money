function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export default function PulseLoading() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      {/* Header */}
      <div className="mb-6 space-y-1.5">
        <Bone className="h-7 w-16" />
        <Bone className="h-3.5 w-64" />
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <Bone className="h-9 w-9 !rounded-xl flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Bone className="h-3.5 w-20" />
                <Bone className="h-2.5 w-28" />
              </div>
            </div>
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

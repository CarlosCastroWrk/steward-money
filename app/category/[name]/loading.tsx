function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export default function CategoryLoading() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Back + header */}
        <Bone className="h-4 w-20 mb-6" />
        <div className="mb-6 space-y-2">
          <Bone className="h-6 w-48" />
          <Bone className="h-3.5 w-32" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-2">
              <Bone className="h-2.5 w-16" />
              <Bone className="h-5 w-20" />
            </div>
          ))}
        </div>

        {/* Merchant list */}
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5">
              <Bone className="h-9 w-9 !rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-28" />
                <Bone className="h-3 w-20" />
              </div>
              <Bone className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

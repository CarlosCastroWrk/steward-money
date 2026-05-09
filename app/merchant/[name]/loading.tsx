function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export default function MerchantLoading() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* Back link */}
        <Bone className="h-4 w-20 mb-6" />

        {/* Merchant header */}
        <div className="mb-6 flex items-center gap-4">
          <Bone className="h-14 w-14 !rounded-2xl flex-shrink-0" />
          <div className="space-y-2">
            <Bone className="h-6 w-40" />
            <Bone className="h-3.5 w-28" />
          </div>
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

        {/* Transaction rows */}
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5">
              <div className="space-y-1.5">
                <Bone className="h-3.5 w-24" />
                <Bone className="h-3 w-16" />
              </div>
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

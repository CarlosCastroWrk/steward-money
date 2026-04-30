function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function BillsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header + total */}
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-24" />
        <Bone className="h-5 w-28" />
      </div>

      {/* Bills list */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
            <div className="flex items-center gap-3">
              <Bone className="h-9 w-9 !rounded-full" />
              <div className="space-y-1.5">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3 w-24" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Bone className="h-4 w-16" />
              <Bone className="h-6 w-20 !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

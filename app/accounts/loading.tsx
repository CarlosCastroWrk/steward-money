function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function AccountsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <Bone className="h-7 w-28" />

      {/* Net summary */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-2.5 w-16" />
              <Bone className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Account cards */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4">
            <div className="flex items-center gap-3">
              <Bone className="h-10 w-10 !rounded-xl" />
              <div className="space-y-1.5">
                <Bone className="h-3.5 w-36" />
                <Bone className="h-3 w-24" />
              </div>
            </div>
            <Bone className="h-5 w-20" />
          </div>
        ))}
      </div>

      {/* Connect bank button */}
      <Bone className="h-11 w-full" />
    </div>
  );
}

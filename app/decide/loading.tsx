function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function DecideLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <div className="space-y-1.5">
        <Bone className="h-7 w-40" />
        <Bone className="h-4 w-64" />
      </div>

      {/* Main decision card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 flex flex-col items-center gap-3">
        <Bone className="h-3 w-32" />
        <Bone className="h-14 w-48" />
        <Bone className="h-4 w-56" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-1.5">
            <Bone className="h-2.5 w-24" />
            <Bone className="h-5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

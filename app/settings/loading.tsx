function Bone({ className }: { className: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-5 px-4 pb-10 pt-5 md:px-8 md:pt-8">
      {/* Header */}
      <div className="space-y-1">
        <Bone className="h-7 w-24" />
        <Bone className="h-3.5 w-48" />
      </div>

      {/* Tab row */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <Bone key={i} className="h-8 w-20 flex-shrink-0 !rounded-full" />
        ))}
      </div>

      {/* Settings sections */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
            <Bone className="h-4 w-32" />
            <div className="space-y-3">
              <Bone className="h-10 w-full" />
              <Bone className="h-10 w-full" />
              {i === 1 && <Bone className="h-10 w-2/3" />}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <Bone className="h-11 w-full" />
    </div>
  );
}

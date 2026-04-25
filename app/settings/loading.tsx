export default function SettingsLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-2 h-6 w-24 rounded-lg bg-zinc-800" />
      <div className="mb-8 h-3 w-52 rounded bg-zinc-800" />
      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 h-4 w-32 rounded bg-zinc-800" />
            <div className="space-y-3">
              <div className="h-9 w-full rounded-lg bg-zinc-800" />
              {i % 2 === 0 && <div className="h-9 w-2/3 rounded-lg bg-zinc-800" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

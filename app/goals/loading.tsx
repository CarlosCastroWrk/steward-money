export default function GoalsLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-6 h-7 w-24 rounded-lg bg-zinc-800" />
      <div className="mb-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-2 h-3 w-16 rounded bg-zinc-800" />
            <div className="h-6 w-10 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-700" />
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-zinc-700" style={{ width: `${30 + i * 15}%` }} />
            </div>
            <div className="mt-2 h-3 w-28 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

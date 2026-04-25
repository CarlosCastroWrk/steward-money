export default function AccountsLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-6 h-7 w-28 rounded-lg bg-zinc-800" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-2 h-3 w-20 rounded bg-zinc-800" />
            <div className="h-7 w-28 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-36 rounded bg-zinc-800" />
              <div className="h-3 w-24 rounded bg-zinc-800" />
            </div>
            <div className="h-5 w-20 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

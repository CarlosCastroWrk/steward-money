export default function TransactionsLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-6 h-7 w-36 rounded-lg bg-zinc-800" />
      <div className="mb-6 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-2 h-3 w-14 rounded bg-zinc-800" />
            <div className="h-6 w-20 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
      <div className="mb-4 flex gap-3">
        <div className="h-9 w-32 rounded-lg bg-zinc-800" />
        <div className="h-9 w-24 rounded-lg bg-zinc-800" />
        <div className="h-9 w-36 rounded-lg bg-zinc-800" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-800" />
              <div className="space-y-1">
                <div className="h-3.5 w-32 rounded bg-zinc-800" />
                <div className="h-3 w-20 rounded bg-zinc-800" />
              </div>
            </div>
            <div className="h-4 w-16 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

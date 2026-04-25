export default function DashboardLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-8 h-7 w-40 rounded-lg bg-zinc-800" />
      <div className="mb-4 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-2 h-3 w-20 rounded bg-zinc-800" />
            <div className="h-7 w-28 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="h-4 w-32 rounded bg-zinc-800" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-zinc-800" />
          ))}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="h-4 w-24 rounded bg-zinc-800" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

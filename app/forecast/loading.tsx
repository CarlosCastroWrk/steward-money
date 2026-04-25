export default function ForecastLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-6 h-7 w-36 rounded-lg bg-zinc-800" />
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 h-4 w-32 rounded bg-zinc-800" />
        <div className="flex items-end gap-1 h-40">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-zinc-800"
              style={{ height: `${40 + Math.sin(i * 0.4) * 30 + 20}%` }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 flex items-center justify-between">
            <div className="h-3.5 w-20 rounded bg-zinc-800" />
            <div className="h-3.5 w-24 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

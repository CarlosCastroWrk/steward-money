export default function DecideLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-2 h-7 w-40 rounded-lg bg-zinc-800" />
      <div className="mb-8 h-4 w-64 rounded bg-zinc-800" />
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-center">
        <div className="mb-3 h-4 w-28 rounded bg-zinc-800" />
        <div className="h-16 w-48 rounded-xl bg-zinc-700" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-2 h-3 w-24 rounded bg-zinc-800" />
            <div className="h-6 w-28 rounded bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

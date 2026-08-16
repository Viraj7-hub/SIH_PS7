export default function VoyageStatus({ status = 'ON TRACK', message = 'Your vessel is following the optimized route.' }) {
  const isUpdated = status === 'ROUTE UPDATED';

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isUpdated ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        {status}
      </div>
      <p className="text-sm text-slate-200">{message}</p>
    </div>
  );
}

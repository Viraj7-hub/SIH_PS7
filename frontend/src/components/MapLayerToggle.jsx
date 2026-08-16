export default function MapLayerToggle({ label, enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800/80"
    >
      <span>{label}</span>
      <span
        className={`flex h-5 w-9 items-center rounded-full border transition ${
          enabled ? 'border-emerald-400 bg-emerald-500/30' : 'border-slate-600 bg-slate-800'
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full bg-white transition ${
            enabled ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}

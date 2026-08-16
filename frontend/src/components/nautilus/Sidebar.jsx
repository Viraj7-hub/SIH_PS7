import { useState, useEffect } from 'react';
import { ChevronDown, Sliders, Anchor, Zap, Clock, ShieldCheck } from 'lucide-react';

/**
 * nautilus/Sidebar.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Route configuration panel:
 *   • Source / destination port dropdowns (loaded from GET /api/ports)
 *   • Vessel configuration
 *   • Priority toggles (fuel / time / safety)
 *   • Calculate Route button
 */

const VESSEL_TYPES = [
  'Container Ship',
  'Bulk Carrier',
  'Tanker',
  'General Cargo',
  'Ro-Ro',
  'LNG Carrier',
  'Chemical Tanker',
  'Offshore Vessel',
];

function PortSelect({ id, label, ports, value, onChange, disabled }) {
  const grouped = {};
  for (const p of ports) {
    if (!grouped[p.country]) grouped[p.country] = [];
    grouped[p.country].push(p);
  }
  const countries = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900
                     px-3 py-2.5 pr-9 text-sm text-white
                     focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          <option value="">Select port…</option>
          {countries.map((country) => (
            <optgroup key={country} label={country}>
              {grouped[country].map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

function PriorityToggle({ id, label, icon: Icon, color, active, onToggle }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium
                  transition-all duration-200 w-full text-left
                  ${active
        ? `border-${color}-500/50 bg-${color}-500/15 text-${color}-300 shadow-sm shadow-${color}-500/20`
        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      <span className={`flex-shrink-0 p-1 rounded-lg ${active ? `bg-${color}-500/20` : 'bg-slate-800'}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{label}</span>
      <span className={`ml-auto text-[0.6rem] font-bold uppercase tracking-wider
                        ${active ? `text-${color}-400` : 'text-slate-600'}`}>
        {active ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

function NumericInput({ id, label, value, onChange, min, max, step = 1, unit, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
        {unit && <span className="ml-1 text-slate-600 normal-case font-normal">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-700 bg-slate-900
                   px-3 py-2 text-sm text-white
                   focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40
                   disabled:opacity-50
                   transition-colors duration-150 [appearance:textfield]
                   [&::-webkit-outer-spin-button]:appearance-none
                   [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

export default function Sidebar({ onCalculate, loading, error, ports = [], portsLoading }) {
  // Port selection
  const [sourcePortId, setSourcePortId]           = useState('');
  const [destinationPortId, setDestinationPortId] = useState('');

  // Vessel spec
  const [vesselType, setVesselType]   = useState('Container Ship');
  const [maxSpeed, setMaxSpeed]       = useState(14);
  const [draft, setDraft]             = useState(12);
  const [fuelConsumption, setFuelConsumption] = useState(0.035);

  // Priorities
  const [fuelPriority,   setFuelPriority]   = useState(true);
  const [timePriority,   setTimePriority]   = useState(false);
  const [safetyPriority, setSafetyPriority] = useState(true);

  const canSubmit = sourcePortId && destinationPortId &&
                    sourcePortId !== destinationPortId && !loading;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onCalculate({
      sourcePortId,
      destinationPortId,
      vessel: {
        type:            vesselType,
        maxSpeed,
        draft,
        fuelConsumption,
      },
      priorities: {
        fuel:   fuelPriority,
        time:   timePriority,
        safety: safetyPriority,
      },
    });
  }

  return (
    <aside className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Anchor className="h-4 w-4 text-cyan-400" />
          <h2 className="text-base font-bold text-white">Route Planner</h2>
        </div>
        <p className="text-[0.7rem] text-slate-500 leading-relaxed">
          Configure your voyage and let the A* optimizer find the best route.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">

        {/* ── Port Selection ────────────────────────────── */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Port Selection
          </h3>
          <PortSelect
            id="source-port"
            label="Origin Port"
            ports={ports}
            value={sourcePortId}
            onChange={setSourcePortId}
            disabled={portsLoading || loading}
          />
          <PortSelect
            id="destination-port"
            label="Destination Port"
            ports={ports}
            value={destinationPortId}
            onChange={setDestinationPortId}
            disabled={portsLoading || loading}
          />
          {sourcePortId && destinationPortId && sourcePortId === destinationPortId && (
            <p className="text-rose-400 text-xs">Origin and destination must differ.</p>
          )}
        </section>

        {/* ── Vessel Configuration ──────────────────────── */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400 flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-slate-500" />
            Vessel Configuration
          </h3>

          <div className="flex flex-col gap-1">
            <label htmlFor="vessel-type" className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vessel Type
            </label>
            <div className="relative">
              <select
                id="vessel-type"
                value={vesselType}
                onChange={(e) => setVesselType(e.target.value)}
                disabled={loading}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900
                           px-3 py-2 pr-9 text-sm text-white
                           focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40
                           disabled:opacity-50 transition-colors duration-150"
              >
                {VESSEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumericInput id="max-speed" label="Max Speed" value={maxSpeed} onChange={setMaxSpeed}
                          min={1} max={40} step={0.5} unit="knots" disabled={loading} />
            <NumericInput id="draft" label="Draft" value={draft} onChange={setDraft}
                          min={1} max={30} step={0.5} unit="metres" disabled={loading} />
          </div>
          <NumericInput id="fuel-consumption" label="Fuel Rate" value={fuelConsumption}
                        onChange={setFuelConsumption} min={0.001} max={1} step={0.001}
                        unit="t/NM" disabled={loading} />
        </section>

        {/* ── Optimization Priorities ───────────────────── */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-2.5">
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            Optimization Priorities
          </h3>
          <p className="text-[0.65rem] text-slate-500">Toggle objectives — the algorithm weights active priorities higher.</p>
          <div className="space-y-2">
            <PriorityToggle id="priority-fuel"   label="Minimize Fuel"   icon={Zap}         color="amber"  active={fuelPriority}   onToggle={() => setFuelPriority(!fuelPriority)} />
            <PriorityToggle id="priority-time"   label="Minimize Time"   icon={Clock}       color="sky"    active={timePriority}   onToggle={() => setTimePriority(!timePriority)} />
            <PriorityToggle id="priority-safety" label="Maximize Safety" icon={ShieldCheck} color="emerald" active={safetyPriority} onToggle={() => setSafetyPriority(!safetyPriority)} />
          </div>
        </section>

        {/* ── Error ─────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* ── Submit ────────────────────────────────────── */}
        <button
          id="calculate-route-btn"
          type="submit"
          disabled={!canSubmit}
          className="mt-auto flex items-center justify-center gap-2 rounded-2xl
                     bg-gradient-to-r from-cyan-600 to-teal-600
                     px-4 py-3 text-sm font-bold text-white tracking-wide
                     hover:from-cyan-500 hover:to-teal-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-200
                     shadow-[0_4px_20px_rgba(6,182,212,0.3)]
                     hover:shadow-[0_4px_30px_rgba(6,182,212,0.5)]
                     active:scale-[0.98]"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Optimizing…
            </>
          ) : (
            <>
              <Anchor className="h-4 w-4" />
              Calculate Route
            </>
          )}
        </button>
      </form>
    </aside>
  );
}

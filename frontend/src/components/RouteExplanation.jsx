import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const factors = [
  { label: 'Safety', value: 40, icon: '🛡' },
  { label: 'Travel Time', value: 30, icon: '⏱' },
  { label: 'Fuel Efficiency', value: 20, icon: '⛽' },
  { label: 'Weather/Cyclone', value: 10, icon: '🌪' },
];

export default function RouteExplanation() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Why this route?</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-200" /> : <ChevronDown className="h-4 w-4 text-slate-200" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <p>Your route is optimized using multiple factors.</p>
          <div className="space-y-3">
            {factors.map((factor) => (
              <div key={factor.label}>
                <div className="mb-1 flex items-center justify-between text-slate-300">
                  <span>{factor.icon} {factor.label}</span>
                  <span>{factor.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${factor.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-300">
            The system evaluates environmental conditions and voyage requirements to select a safer and more efficient route.
          </p>
        </div>
      )}
    </div>
  );
}

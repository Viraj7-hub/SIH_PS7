import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const defaultFactors = [
  { factor: 'Safety', impact: 'positive', reason: 'Avoids high-risk wave corridors and storm zones' },
  { factor: 'Fuel', impact: 'positive', reason: 'Optimized speed profile reduces fuel consumption' },
  { factor: 'Time', impact: 'neutral', reason: 'Maintains optimal travel duration' },
];

export default function RouteExplanation({ explanation }) {
  const [open, setOpen] = useState(false);

  const summary = explanation?.summary || 'Your route is optimized using Multi-Objective A* balancing fuel efficiency, travel time, and marine safety.';
  const factorsList = explanation?.factors?.length ? explanation.factors : defaultFactors;

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" /> Why this route?
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-200" /> : <ChevronDown className="h-4 w-4 text-slate-200" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3 text-sm text-slate-200">
          <p className="text-slate-300 text-xs leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            {summary}
          </p>

          <div className="space-y-2">
            {factorsList.map((item, index) => (
              <div key={`${item.factor}-${index}`} className="flex items-start gap-2 text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase ${
                  item.impact === 'positive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  item.impact === 'negative' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {item.factor}
                </span>
                <span className="text-slate-300 flex-1">{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

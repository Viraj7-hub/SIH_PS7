import { Fuel, Clock, ShieldCheck, TrendingDown, TrendingUp, Minus,
         BarChart2, Info, Zap, Navigation } from 'lucide-react';

/**
 * nautilus/MetricsDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Displays the full optimization result:
 *   • Standard vs Optimized route comparison table
 *   • Metrics: fuel saved %, risk level, ETA
 *   • Algorithm details (name, weights used)
 *   • Route explanation (derived from real optimization results)
 */

function MetricCard({ id, label, value, sub, accent = 'cyan', icon: Icon }) {
  const accents = {
    cyan:   'border-cyan-500/30 bg-cyan-500/8 text-cyan-300',
    emerald:'border-emerald-500/30 bg-emerald-500/8 text-emerald-300',
    amber:  'border-amber-500/30 bg-amber-500/8 text-amber-300',
    rose:   'border-rose-500/30 bg-rose-500/8 text-rose-300',
    violet: 'border-violet-500/30 bg-violet-500/8 text-violet-300',
  };
  return (
    <div id={id}
         className={`rounded-2xl border p-4 ${accents[accent] || accents.cyan} backdrop-blur-sm`}>
      {Icon && <Icon className="mb-2 h-4 w-4 opacity-70" />}
      <div className="text-[0.6rem] uppercase tracking-[0.2em] opacity-60 mb-1">{label}</div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-[0.65rem] opacity-60">{sub}</div>}
    </div>
  );
}

function RouteCompareRow({ label, std, opt, better, unit = '' }) {
  const stdNum = parseFloat(std);
  const optNum = parseFloat(opt);
  const diff   = stdNum > 0 ? ((optNum - stdNum) / stdNum) * 100 : 0;
  const improved = better === 'lower' ? optNum < stdNum : optNum > stdNum;

  return (
    <tr className="border-b border-slate-800/60">
      <td className="py-2.5 pr-4 text-xs text-slate-400 font-medium whitespace-nowrap">{label}</td>
      <td className="py-2.5 pr-4 text-xs text-slate-300 text-right tabular-nums">
        {stdNum.toFixed(stdNum < 10 ? 2 : 1)}{unit}
      </td>
      <td className="py-2.5 pr-4 text-xs text-right tabular-nums font-semibold
                     text-cyan-300">
        {optNum.toFixed(optNum < 10 ? 2 : 1)}{unit}
      </td>
      <td className="py-2.5 text-right">
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold
                          ${improved
          ? 'bg-emerald-500/15 text-emerald-300'
          : Math.abs(diff) < 0.5
            ? 'bg-slate-800 text-slate-500'
            : 'bg-rose-500/15 text-rose-300'
        }`}>
          {improved ? <TrendingDown className="h-2.5 w-2.5" />
            : Math.abs(diff) < 0.5 ? <Minus className="h-2.5 w-2.5" />
            : <TrendingUp className="h-2.5 w-2.5" />}
          {Math.abs(diff) < 0.5 ? '—' : `${Math.abs(diff).toFixed(1)}%`}
        </span>
      </td>
    </tr>
  );
}

function ExplanationFactor({ factor, impact, reason }) {
  const colors = {
    positive: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: 'text-emerald-400', label: 'text-emerald-300' },
    negative: { bg: 'bg-rose-500/10 border-rose-500/30',       icon: 'text-rose-400',    label: 'text-rose-300'    },
    neutral:  { bg: 'bg-slate-800/80 border-slate-700/60',     icon: 'text-slate-400',   label: 'text-slate-300'   },
  };
  const c = colors[impact] || colors.neutral;
  const Icon = impact === 'positive' ? TrendingDown : impact === 'negative' ? TrendingUp : Minus;

  return (
    <div className={`flex gap-3 rounded-xl border p-3 ${c.bg}`}>
      <span className={`flex-shrink-0 mt-0.5 ${c.icon}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className={`text-[0.65rem] font-bold uppercase tracking-wide ${c.label}`}>{factor}</div>
        <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{reason}</div>
      </div>
    </div>
  );
}

function WeightBar({ label, value, color }) {
  const pct = Math.round(value * 100);
  const colors = {
    amber:  'bg-amber-400',
    sky:    'bg-sky-400',
    emerald:'bg-emerald-400',
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-slate-400 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800">
        <div className={`h-1.5 rounded-full ${colors[color] || 'bg-slate-500'} transition-all duration-700`}
             style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-slate-300 tabular-nums">{pct}%</span>
    </div>
  );
}

export default function MetricsDashboard({ data }) {
  if (!data) return null;

  const { standardRoute, optimizedRoute, metrics, algorithm, explanation, source, destination } = data;

  const riskLevelColors = {
    safe:     'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    moderate: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    elevated: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    high:     'text-rose-300 bg-rose-500/10 border-rose-500/30',
  };

  return (
    <div className="space-y-5" id="metrics-dashboard">

      {/* ── Route Summary Banner ────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-slate-500">Optimized Route</div>
            <div className="text-lg font-bold text-white mt-0.5">
              {source?.name} → {destination?.name}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1
                           text-[0.65rem] font-bold uppercase tracking-wide
                           ${riskLevelColors[metrics.riskLevel] || riskLevelColors.moderate}`}>
            <ShieldCheck className="h-3 w-3" />
            {metrics.riskLevel}
          </span>
        </div>
      </div>

      {/* ── Top Metrics ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          id="metric-fuel-saved"
          label="Fuel Saved"
          value={`${metrics.fuelSavedPercent >= 0 ? '+' : ''}${metrics.fuelSavedPercent.toFixed(1)}%`}
          sub={`${optimizedRoute.fuelTons.toFixed(1)} t (opt) vs ${standardRoute.fuelTons.toFixed(1)} t (std)`}
          accent={metrics.fuelSavedPercent > 0 ? 'emerald' : 'rose'}
          icon={Fuel}
        />
        <MetricCard
          id="metric-eta"
          label="ETA"
          value={`${metrics.etaDays.toFixed(1)} days`}
          sub={`${metrics.etaHours.toFixed(1)} hours total`}
          accent="cyan"
          icon={Clock}
        />
        <MetricCard
          id="metric-risk"
          label="Risk Score"
          value={`${metrics.riskScore}/100`}
          sub={metrics.riskLevel.charAt(0).toUpperCase() + metrics.riskLevel.slice(1)}
          accent={metrics.riskScore < 30 ? 'emerald' : metrics.riskScore < 60 ? 'amber' : 'rose'}
          icon={ShieldCheck}
        />
        <MetricCard
          id="metric-distance"
          label="Opt. Distance"
          value={`${optimizedRoute.distanceNM.toFixed(0)} NM`}
          sub={`${(optimizedRoute.distanceNM * 1.852).toFixed(0)} km`}
          accent="violet"
          icon={Navigation}
        />
      </div>

      {/* ── Comparison Table ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-slate-400" />
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400">
            Standard vs Optimized
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="pb-2 text-left text-[0.6rem] uppercase tracking-[0.18em] text-slate-600 pr-4">Metric</th>
                <th className="pb-2 text-right text-[0.6rem] uppercase tracking-[0.18em] text-slate-500 pr-4">Standard</th>
                <th className="pb-2 text-right text-[0.6rem] uppercase tracking-[0.18em] text-cyan-500 pr-4">Optimized</th>
                <th className="pb-2 text-right text-[0.6rem] uppercase tracking-[0.18em] text-slate-600">Δ</th>
              </tr>
            </thead>
            <tbody>
              <RouteCompareRow label="Distance"      std={standardRoute.distanceNM}  opt={optimizedRoute.distanceNM}  better="lower" unit=" NM" />
              <RouteCompareRow label="Duration"      std={standardRoute.durationHrs} opt={optimizedRoute.durationHrs} better="lower" unit=" hrs" />
              <RouteCompareRow label="Fuel"          std={standardRoute.fuelTons}    opt={optimizedRoute.fuelTons}    better="lower" unit=" t" />
              <RouteCompareRow label="Safety Score"  std={standardRoute.safetyScore} opt={optimizedRoute.safetyScore} better="higher" />
              <RouteCompareRow label="Waypoints"     std={standardRoute.nodeCount}   opt={optimizedRoute.nodeCount}   better="neutral" />
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Algorithm Info ────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-violet-400" />
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400">
            {algorithm.name}
          </h3>
          <span className="ml-auto text-[0.6rem] text-slate-600 font-mono">
            obj: {algorithm.objectives.join(', ') || 'balanced'}
          </span>
        </div>
        <div className="space-y-2">
          <WeightBar label="Fuel"   value={algorithm.weights.fuel}   color="amber"   />
          <WeightBar label="Time"   value={algorithm.weights.time}   color="sky"     />
          <WeightBar label="Safety" value={algorithm.weights.safety} color="emerald" />
        </div>
        <p className="mt-3 text-[0.6rem] text-slate-600 leading-relaxed">
          Weights are derived from your priority selections and normalized so they sum to 1.
          Higher weight = more influence on the optimized path selection.
        </p>
      </div>

      {/* ── Weather Summary ───────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <p className="text-xs text-slate-400">{metrics.weatherSummary}</p>
        </div>
      </div>

      {/* ── Route Explanation ─────────────────────────────── */}
      {explanation && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 backdrop-blur-sm">
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Why This Route?
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
            {explanation.summary}
          </p>
          <div className="space-y-2">
            {explanation.factors.map((f, i) => (
              <ExplanationFactor key={i} {...f} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

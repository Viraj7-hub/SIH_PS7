import { Activity, AlertTriangle, Gauge, MapPinned, Clock3, ShieldCheck } from 'lucide-react';

const iconMap = {
  distance: MapPinned,
  time: Clock3,
  arrival: Activity,
  speed: Gauge,
  safety: ShieldCheck,
  weather: AlertTriangle,
};

export default function VoyageCard({ title, value, subtext, tone = 'default', icon }) {
  const Icon = iconMap[icon] || Activity;

  const tones = {
    default: 'border-slate-700/60 bg-slate-900/80 text-slate-50',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-lg ${tones[tone] || tones.default}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {title}
        </span>
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
      {subtext && <div className="mt-2 text-xs text-slate-300">{subtext}</div>}
    </div>
  );
}

import { Bell, LogOut, ShipWheel, UserRound, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Header({ shipName, shipId, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between rounded-[26px] border border-slate-700/70 bg-slate-950/80 px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-lg text-cyan-300 ring-1 ring-cyan-400/20">
          🚢
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-white">OceanRoute</div>
        </div>
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300 md:flex">
        <ShipWheel className="h-4 w-4 text-cyan-300" />
        <span>Passenger Voyage</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Nautilus Router shortcut */}
        <button
          type="button"
          onClick={() => navigate('/nautilus')}
          title="Open Nautilus Route Optimizer"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-cyan-500/40
                     bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300
                     transition hover:bg-cyan-500/20 hover:border-cyan-400"
        >
          <Compass className="h-3.5 w-3.5" />
          Nautilus Router
        </button>

        <div className="hidden rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-right shadow-sm sm:block">
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-slate-400">Ship</div>
          <div className="text-sm font-medium text-white">{shipName}</div>
          <div className="text-[0.7rem] text-cyan-300">{shipId}</div>
        </div>

        <button type="button" className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2.5 text-slate-200 transition hover:border-cyan-400 hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2.5 text-slate-200 transition hover:border-cyan-400 hover:text-white">
          <UserRound className="h-4 w-4" />
        </button>
        <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}


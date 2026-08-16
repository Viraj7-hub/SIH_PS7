import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShipWheel, ArrowRight } from 'lucide-react';
import { getShip } from '../services/api';

const demoShips = [
  { id: 'SHIP001', name: 'Ocean Star' },
  { id: 'SHIP002', name: 'Arabian Voyager' },
  { id: 'SHIP003', name: 'Indian Ocean Express' },
];

export default function ShipSelect() {
  const navigate = useNavigate();
  const [shipId, setShipId] = useState('SHIP001');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!shipId.trim()) {
      setError('Ship ID not found. Please check your Ship ID.');
      return;
    }

    try {
      setLoading(true);
      const response = await getShip(shipId.trim().toUpperCase());
      localStorage.setItem('oceanroute_ship', JSON.stringify(response.data));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Ship ID not found. Please check your Ship ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0b2440_0%,#020817_45%,#01060d_100%)] px-4 py-10 text-white">
      <div className="w-full max-w-xl rounded-[30px] border border-slate-700/70 bg-slate-900/80 p-7 shadow-[0_30px_80px_rgba(2,6,23,0.6)] backdrop-blur-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-cyan-300">
          <ShipWheel className="h-8 w-8" />
          <span className="text-2xl font-semibold">OceanRoute</span>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white">Select Your Voyage</h1>
          <p className="mt-2 text-slate-300">Enter your ship ID to access your journey.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Ship ID</label>
            <input
              type="text"
              value={shipId}
              onChange={(e) => setShipId(e.target.value.toUpperCase())}
              placeholder="SHIP001"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>

          {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Checking ship...' : 'View Voyage'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-8 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Demo IDs</div>
          {demoShips.map((ship) => (
            <button
              key={ship.id}
              type="button"
              onClick={() => setShipId(ship.id)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800/60"
            >
              <span>{ship.id}</span>
              <span>{ship.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

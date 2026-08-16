import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import Sidebar         from '../components/nautilus/Sidebar';
import MapCanvas       from '../components/nautilus/MapCanvas';
import MetricsDashboard from '../components/nautilus/MetricsDashboard';
import { getPorts, optimizeNautilusRoute } from '../services/api';

/**
 * pages/NautilusRouter.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Top-level Nautilus Route Optimizer page at /nautilus
 *
 * Layout:
 *   [Sidebar config] | [Map] stacked above [Metrics Dashboard]
 *
 * Data flow:
 *   1. On mount → fetch all ports from GET /api/ports
 *   2. On form submit → call POST /api/routes/optimize
 *   3. Pass result down to MapCanvas and MetricsDashboard
 *
 * No Math.random(), no mock data, no hardcoded routes.
 */

export default function NautilusRouter() {
  const navigate = useNavigate();

  // Ports (for dropdowns)
  const [ports, setPorts]           = useState([]);
  const [portsLoading, setPortsLoading] = useState(true);

  // Route result
  const [routeData, setRouteData]   = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError]           = useState('');

  // Fetch ports on mount
  useEffect(() => {
    let cancelled = false;
    getPorts()
      .then((res) => {
        if (!cancelled) setPorts(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load port list. Ensure the backend is running.');
      })
      .finally(() => {
        if (!cancelled) setPortsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Calculate route
  const handleCalculate = useCallback(async (params) => {
    setCalculating(true);
    setError('');
    setRouteData(null);
    try {
      const res = await optimizeNautilusRoute(params);
      if (res.data?.success) {
        setRouteData(res.data.data);
      } else {
        setError(res.data?.message || 'Route optimization failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Route optimization failed.';
      setError(msg);
    } finally {
      setCalculating(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#0b2440_0%,#020817_50%,#01060d_100%)]
                    text-white">

      {/* ── Page Header ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md px-5 py-3">
        <div className="mx-auto max-w-screen-2xl flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5
                       text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </button>

          <div className="flex items-center gap-2 ml-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl
                            bg-gradient-to-br from-cyan-500/20 to-teal-500/20
                            border border-cyan-500/30">
              <Compass className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Nautilus Router</h1>
              <p className="text-[0.6rem] text-slate-500 -mt-0.5">Multi-Objective A* Route Optimizer</p>
            </div>
          </div>

          {routeData && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[0.65rem] text-slate-500">Last route:</span>
              <span className="text-xs text-cyan-300 font-medium">
                {routeData.source.name} → {routeData.destination.name}
              </span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30
                               px-2 py-0.5 text-[0.6rem] font-bold text-emerald-300">
                {routeData.metrics.fuelSavedPercent >= 0 ? '+' : ''}{routeData.metrics.fuelSavedPercent.toFixed(1)}% fuel
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────── */}
      <main className="mx-auto max-w-screen-2xl px-4 py-5 md:px-6">
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">

          {/* Left: Sidebar config panel */}
          <div className="lg:sticky lg:top-[61px] lg:h-[calc(100vh-80px)] lg:overflow-y-auto
                          scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent
                          rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 backdrop-blur-sm">
            <Sidebar
              ports={ports}
              portsLoading={portsLoading}
              loading={calculating}
              error={error}
              onCalculate={handleCalculate}
            />
          </div>

          {/* Right: Map + Metrics */}
          <div className="flex flex-col gap-5">

            {/* Map */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-3 backdrop-blur-sm"
                 style={{ minHeight: 440 }}>
              <MapCanvas
                standardRoute={routeData?.standardRoute}
                optimizedRoute={routeData?.optimizedRoute}
                source={routeData?.source}
                destination={routeData?.destination}
                loading={calculating}
              />
            </div>

            {/* Empty state */}
            {!routeData && !calculating && !error && (
              <div className="rounded-2xl border border-dashed border-slate-700/60
                              bg-slate-900/30 p-10 text-center">
                <Compass className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                <h3 className="text-slate-400 font-semibold mb-1">No Route Calculated Yet</h3>
                <p className="text-sm text-slate-600">
                  Select origin and destination ports, configure your vessel, choose priorities,
                  then press <strong className="text-slate-400">Calculate Route</strong>.
                </p>
              </div>
            )}

            {/* Error state */}
            {error && !calculating && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/8
                              p-4 text-sm text-rose-300">
                <strong className="font-semibold">Error:</strong> {error}
              </div>
            )}

            {/* Metrics dashboard */}
            {routeData && !calculating && (
              <MetricsDashboard data={routeData} />
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

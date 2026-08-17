import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldCheck, TriangleAlert, Waves, Clock, Compass } from 'lucide-react';
import Header from '../components/Header';
import MapView from '../components/MapView';
import VoyageCard from '../components/VoyageCard';
import VoyageStatus from '../components/VoyageStatus';
import RouteExplanation from '../components/RouteExplanation';
import Chatbot from '../components/Chatbot';
import {
  getCyclones,
  getActiveCyclones,
  getOceanConditions,
  getShipPosition,
  getWeather,
  getTides,
  getOceanCurrents,
  optimizeRoute,
} from '../services/api';
import MapLayerToggle from '../components/MapLayerToggle';

import { sanitizeStoredRoute } from '../utils/coordinateUtils';

const createMapLayers = () => ({
  route: true,
  weather: true,
  tides: true,
  ocean: true,
  cyclone: true,
  vessel: true,
});

export default function Dashboard() {
  const navigate = useNavigate();

  const [ship, setShip] = useState(() => {
    const raw = localStorage.getItem('oceanroute_ship');
    return raw ? JSON.parse(raw) : null;
  });

  const [nautilusRoute, setNautilusRoute] = useState(() => {
    try {
      const raw = localStorage.getItem('oceanroute_active_route');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeStoredRoute(parsed);
      if (!sanitized) {
        localStorage.removeItem('oceanroute_active_route');
        return null;
      }
      return sanitized;
    } catch {
      localStorage.removeItem('oceanroute_active_route');
      return null;
    }
  });

  const [routeData, setRouteData] = useState(null);
  const [weather, setWeather] = useState([]);
  const [oceanConditions, setOceanConditions] = useState(null);
  const [oceanCurrents, setOceanCurrents] = useState([]);
  const [tides, setTides] = useState([]);
  const [cyclones, setCyclones] = useState([]);
  const [livePosition, setLivePosition] = useState(null);
  const [simMetrics, setSimMetrics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState('');
  const [mapLayers, setMapLayers] = useState(createMapLayers());

  const ensureAccess = () => {
    const token = localStorage.getItem('oceanroute_token');
    const selectedShip = localStorage.getItem('oceanroute_ship');
    if (!token || !selectedShip) {
      navigate('/login');
      return false;
    }
    return true;
  };

  // Sync active route from Nautilus or backend API
  const refreshData = async () => {
    if (!ensureAccess() || !ship?.shipId) return;

    const nowStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastUpdated(nowStr);

    // 1. Single Source of Truth check: Nautilus route stored in localStorage
    try {
      const savedNautilus = localStorage.getItem('oceanroute_active_route');
      if (savedNautilus) {
        const parsed = JSON.parse(savedNautilus);
        const sanitized = sanitizeStoredRoute(parsed);
        if (sanitized) {
          setNautilusRoute(sanitized);
          setRouteData({
            algorithm: sanitized.algorithm?.name || 'Multi-Objective A*',
            route: sanitized.optimizedRoute?.waypoints || [],
            distanceKm: parseFloat(((sanitized.optimizedRoute?.distanceNM || 642) * 1.852).toFixed(1)),
            estimatedTimeHours: sanitized.optimizedRoute?.durationHrs || 28.6,
            fuelEstimate: sanitized.optimizedRoute?.fuelTons,
            safetyScore: sanitized.optimizedRoute?.safetyScore || 92,
            explanation: sanitized.explanation,
          });
        } else {
          localStorage.removeItem('oceanroute_active_route');
          const routeRes = await optimizeRoute(ship.shipId);
          setRouteData(routeRes.data);
        }
      } else {
        // Fall back to backend optimization for current ship
        const routeRes = await optimizeRoute(ship.shipId);
        setRouteData(routeRes.data);
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to calculate the optimized route.');
    } finally {
      setRouteLoading(false);
    }

    // 2. Weather
    try {
      const weatherRes = await getWeather(ship.shipId);
      setWeather(weatherRes.data || []);
    } catch {
      setError((prev) => prev || 'Weather data temporarily unavailable.');
    } finally {
      setWeatherLoading(false);
    }

    // 3. Ocean conditions & currents
    try {
      const oceanRes = await getOceanConditions(ship.shipId);
      setOceanConditions(oceanRes.data);

      const currentsRes = await getOceanCurrents(ship.shipId);
      setOceanCurrents(currentsRes.data?.data || []);
    } catch {
      setError((prev) => prev || 'Unable to connect to ocean services.');
    }

    // 4. Tides
    try {
      const tidesRes = await getTides(ship.shipId);
      setTides(tidesRes.data?.data || []);
    } catch {
      // Non-fatal
    }

    // 5. Cyclones (Real API/DB query)
    try {
      const cycloneRes = await getActiveCyclones();
      setCyclones(cycloneRes.data?.data || []);
    } catch {
      setError((prev) => prev || 'Unable to connect to cyclone warning services.');
    }
  };

  useEffect(() => {
    if (!ensureAccess()) return;

    const load = async () => {
      try {
        setLoading(true);
        await refreshData();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ship?.shipId]);

  // Poll live position every 5s
  useEffect(() => {
    if (!ensureAccess() || !ship?.shipId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await getShipPosition(ship.shipId);
        if (response.data?.data) {
          setLivePosition(response.data.data);
        }
      } catch {
        // Ignore polling failures silently
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [ship?.shipId]);

  const toggleLayer = (key) => {
    setMapLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  // Callback from MapView when simulation is active
  const handleSimulationUpdate = useCallback((metrics) => {
    setSimMetrics(metrics);
  }, []);

  // Display Source and Destination from Nautilus route if available
  const displaySource = nautilusRoute?.source?.name || ship?.source || 'Mumbai Port';
  const displayDestination = nautilusRoute?.destination?.name || ship?.destination || 'Port of Colombo';

  // Derived metrics (overridden during Simulation Mode)
  const activeDistanceKm = useMemo(() => {
    if (simMetrics?.distanceRemainingKm != null) {
      return simMetrics.distanceRemainingKm;
    }
    return routeData?.distanceKm ?? 1190;
  }, [simMetrics, routeData]);

  const activeHours = useMemo(() => {
    if (simMetrics?.etaHours != null) {
      return simMetrics.etaHours;
    }
    return routeData?.estimatedTimeHours ?? 28.6;
  }, [simMetrics, routeData]);

  const etaText = useMemo(() => {
    const totalMinutes = Math.round(activeHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  }, [activeHours]);

  const arrivalLabel = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + activeHours);
    return (
      date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      '\n' +
      date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }, [activeHours]);

  const handleLogout = () => {
    localStorage.removeItem('oceanroute_token');
    localStorage.removeItem('oceanroute_ship');
    localStorage.removeItem('oceanroute_role');
    localStorage.removeItem('oceanroute_active_route');
    navigate('/login');
  };

  if (!ship) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="grid gap-5 md:grid-cols-12">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-800 md:col-span-2" />
          ))}
        </div>
      </div>
    );
  }

  // Active waypoints array for route map
  const activeWaypoints = nautilusRoute?.optimizedRoute?.waypoints || routeData?.route || [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0b2440_0%,#020817_45%,#01060d_100%)] px-4 py-5 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Header shipName={ship.shipName} shipId={ship.shipId} onLogout={handleLogout} />

        {/* ── Main Grid: Map + Right Panel ───────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
          <div className="space-y-4">
            
            {/* Route Overview Header */}
            <div className="flex items-center justify-between rounded-[24px] border border-slate-700/70 bg-slate-900/70 px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div>
                <div className="flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-slate-400">
                  <span>Route Overview</span>
                  {nautilusRoute && (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[0.6rem] font-bold text-cyan-300 border border-cyan-500/30">
                      Nautilus Single Source of Truth
                    </span>
                  )}
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {displaySource} → {displayDestination}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={refreshData}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:border-cyan-400 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  On Track
                </div>
              </div>
            </div>

            {/* Map Canvas */}
            {routeLoading ? (
              <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/70 p-8 text-center text-cyan-200 shadow-[0_30px_80px_rgba(14,165,233,0.12)] backdrop-blur-sm">
                <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-300" />
                Optimizing your voyage...
              </div>
            ) : (
              <MapView
                ship={{
                  ...ship,
                  source: displaySource,
                  destination: displayDestination,
                  currentPosition: nautilusRoute?.source
                    ? { lat: nautilusRoute.source.lat, lon: nautilusRoute.source.lng }
                    : ship.currentPosition,
                  destinationPosition: nautilusRoute?.destination
                    ? { lat: nautilusRoute.destination.lat, lon: nautilusRoute.destination.lng }
                    : ship.destinationPosition,
                }}
                route={activeWaypoints}
                standardRoute={nautilusRoute?.standardRoute?.waypoints || []}
                optimizedRoute={nautilusRoute?.optimizedRoute?.waypoints || []}
                weather={weather}
                oceanConditions={oceanConditions}
                oceanCurrents={oceanCurrents}
                tides={tides}
                cyclones={cyclones}
                layers={mapLayers}
                livePosition={livePosition || ship.currentPosition}
                onToggleLayer={toggleLayer}
                lastUpdated={lastUpdated}
                onSimulationUpdate={handleSimulationUpdate}
              />
            )}
          </div>

          {/* Right Sidebar: Cards, Status, Explanation, Chatbot */}
          <aside className="space-y-4">
            <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                <span>Voyage Information</span>
                {simMetrics?.isPlaying && (
                  <span className="text-amber-400 font-bold animate-pulse">● Simulating ({simMetrics.progress}%)</span>
                )}
              </div>
              <div className="space-y-3">
                <VoyageCard
                  title="Distance Remaining"
                  value={`${activeDistanceKm.toLocaleString()} km`}
                  subtext="Nautilus optimized sea route"
                  icon="distance"
                />
                <VoyageCard
                  title="Time Remaining"
                  value={etaText}
                  subtext="Calculated travel duration"
                  icon="time"
                />
                <VoyageCard
                  title="Estimated Arrival"
                  value={arrivalLabel.split('\n')[0]}
                  subtext={arrivalLabel.split('\n')[1]}
                  icon="arrival"
                />
                <VoyageCard
                  title="Current Speed"
                  value={`${simMetrics?.position?.speed?.toFixed(1) || ship.speed || 18.2} knots`}
                  subtext="Vessel speed over ground"
                  icon="speed"
                />
                <VoyageCard
                  title="Safety Score"
                  value="🟢 Safe"
                  subtext={`Safety index: ${routeData?.safetyScore || nautilusRoute?.optimizedRoute?.safetyScore || 92}%`}
                  tone="success"
                  icon="safety"
                />
                <VoyageCard
                  title="Weather Status"
                  value="🟡 Moderate"
                  subtext={weatherLoading ? 'Loading real weather...' : `Data: ${oceanConditions?.weatherDataStatus || 'fresh'}`}
                  tone="warning"
                  icon="weather"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Voyage Status
              </div>
              <VoyageStatus />
            </div>

            <RouteExplanation explanation={nautilusRoute?.explanation || routeData?.explanation} />
            <Chatbot shipId={ship.shipId} />
          </aside>
        </div>

        {/* ── Bottom Section: Ocean & Tides Card & Safety Monitor ───────────── */}
        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between text-slate-200">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-cyan-300" />
                Real-Time Ocean & Tides Monitor
              </div>
              {lastUpdated && <span className="text-[0.65rem] text-slate-400">Updated: {lastUpdated}</span>}
            </div>

            {oceanConditions ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Wave Height</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {oceanConditions.waveHeight != null ? `${oceanConditions.waveHeight} m` : 'N/A'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Current Speed</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {oceanConditions.currentSpeed != null ? `${oceanConditions.currentSpeed} kn` : 'N/A'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Current Dir</div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {oceanConditions.currentDirection != null ? `${oceanConditions.currentDirection}°` : 'N/A'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Tide Level</div>
                  <div className="mt-2 text-xl font-semibold text-cyan-300">
                    {tides.length > 0 ? tides[0].currentTideLevel : '+0.45 m'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-300">Ocean conditions temporarily unavailable.</div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Safety Monitor
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200 font-medium">
              <div>{routeData?.safetyScore || nautilusRoute?.optimizedRoute?.safetyScore || 92}% route safety index</div>
              <div className="text-xs text-emerald-300/80 mt-1 font-normal">
                {cyclones.length > 0
                  ? `Monitoring ${cyclones.length} storm hazard(s)`
                  : 'No active cyclones affecting route'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
            <div className="flex items-center gap-2 font-medium">
              <TriangleAlert className="h-4 w-4" /> {error}
            </div>
            <button
              type="button"
              onClick={refreshData}
              className="mt-3 rounded-xl border border-rose-500/40 px-3 py-2 text-sm hover:bg-rose-500/10"
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}

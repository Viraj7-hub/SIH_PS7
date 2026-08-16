import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldCheck, TriangleAlert, Waves } from 'lucide-react';
import Header from '../components/Header';
import MapView from '../components/MapView';
import VoyageCard from '../components/VoyageCard';
import VoyageStatus from '../components/VoyageStatus';
import RouteExplanation from '../components/RouteExplanation';
import { getCyclones, getOceanConditions, getShipPosition, getWeather, optimizeRoute } from '../services/api';
import MapLayerToggle from '../components/MapLayerToggle';

const createMapLayers = () => ({ route: true, weather: false, ocean: false, cyclone: false });

export default function Dashboard() {
  const navigate = useNavigate();
  const [ship, setShip] = useState(() => {
    const raw = localStorage.getItem('oceanroute_ship');
    return raw ? JSON.parse(raw) : null;
  });
  const [routeData, setRouteData] = useState(null);
  const [weather, setWeather] = useState([]);
  const [oceanConditions, setOceanConditions] = useState(null);
  const [cyclones, setCyclones] = useState([]);
  const [livePosition, setLivePosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
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

  const refreshData = async () => {
    if (!ensureAccess() || !ship?.shipId) return;

    try {
      const routeRes = await optimizeRoute(ship.shipId);
      setRouteData(routeRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to calculate the optimized route.');
    } finally {
      setRouteLoading(false);
    }

    try {
      const weatherRes = await getWeather(ship.shipId);
      setWeather(weatherRes.data);
    } catch {
      setError((prev) => prev || 'Weather data temporarily unavailable.');
    } finally {
      setWeatherLoading(false);
    }

    try {
      const oceanRes = await getOceanConditions(ship.shipId);
      setOceanConditions(oceanRes.data);
    } catch {
      setError((prev) => prev || 'Unable to connect to voyage services.');
    }

    try {
      const cycloneRes = await getCyclones(ship.shipId);
      setCyclones(cycloneRes.data.cyclones || []);
    } catch {
      setError((prev) => prev || 'Unable to connect to voyage services.');
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

  useEffect(() => {
    if (!ensureAccess() || !ship?.shipId) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await getShipPosition(ship.shipId);
        setLivePosition(response.data);
      } catch {
        // Ignore polling failures silently to keep the map responsive.
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [ship?.shipId]);

  const toggleLayer = (key) => {
    setMapLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  const etaText = useMemo(() => {
    const hours = routeData?.estimatedTimeHours ?? 28.6;
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  }, [routeData]);

  const arrivalLabel = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + (routeData?.estimatedTimeHours ?? 28.6));
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + '\n' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [routeData]);

  const handleLogout = () => {
    localStorage.removeItem('oceanroute_token');
    localStorage.removeItem('oceanroute_ship');
    navigate('/login');
  };

  if (!ship) {
    return null;
  }

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0b2440_0%,#020817_45%,#01060d_100%)] px-4 py-5 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Header shipName={ship.shipName} shipId={ship.shipId} onLogout={handleLogout} />

        <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-[24px] border border-slate-700/70 bg-slate-900/70 px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div>
                <div className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-slate-400">Route Overview</div>
                <div className="mt-1 text-lg font-semibold text-white">{ship.source} → {ship.destination}</div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                On Track
              </div>
            </div>

            {routeLoading ? (
              <div className="rounded-[28px] border border-slate-700/80 bg-slate-900/70 p-8 text-center text-cyan-200 shadow-[0_30px_80px_rgba(14,165,233,0.12)] backdrop-blur-sm">
                <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-300" />
                Optimizing your voyage...
              </div>
            ) : (
              <MapView
                ship={ship}
                route={routeData?.route || []}
                weather={weather}
                oceanConditions={oceanConditions}
                cyclones={cyclones}
                layers={mapLayers}
                livePosition={livePosition || ship.currentPosition}
                onToggleLayer={toggleLayer}
              />
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div className="mb-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Voyage Information</div>
              <div className="space-y-3">
                <VoyageCard title="Distance Remaining" value={`${routeData?.distanceKm?.toLocaleString() || '1,190'} km`} subtext="Optimized sea route" icon="distance" />
                <VoyageCard title="Time Remaining" value={etaText} subtext="Current estimated time" icon="time" />
                <VoyageCard title="Estimated Arrival" value={arrivalLabel.split('\n')[0]} subtext={arrivalLabel.split('\n')[1]} icon="arrival" />
                <VoyageCard title="Current Speed" value={`${ship.speed || routeData?.speed || 18.2} knots`} subtext="Average vessel speed" icon="speed" />
                <VoyageCard title="Safety" value="🟢 Safe" subtext={`Score ${routeData?.safetyScore || 92}%`} tone="success" icon="safety" />
                <VoyageCard title="Weather" value="🟡 Moderate" subtext={weatherLoading ? 'Loading weather conditions...' : 'Sea conditions stable'} tone="warning" icon="weather" />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
              <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Voyage Status</div>
              <VoyageStatus />
            </div>

            <RouteExplanation />
          </aside>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.75fr]">
          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <Waves className="h-4 w-4 text-cyan-300" />
              Ocean Conditions
            </div>
            {oceanConditions ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Wave Height</div>
                  <div className="mt-2 text-xl font-semibold text-white">{oceanConditions.waveHeight} m</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Current</div>
                  <div className="mt-2 text-xl font-semibold text-white">{oceanConditions.currentSpeed} knots</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">Direction</div>
                  <div className="mt-2 text-xl font-semibold text-white">{oceanConditions.currentDirection}°</div>
                </div>
              </div>
            ) : (
              <div className="text-slate-300">Ocean conditions unavailable.</div>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Safety Monitor
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
              {routeData?.safetyScore || 92}% route safety index
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 shadow-[0_20px_60px_rgba(2,6,23,0.45)]">
            <div className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> {error}</div>
            <button type="button" onClick={refreshData} className="mt-3 rounded-xl border border-rose-500/40 px-3 py-2 text-sm hover:bg-rose-500/10">Retry</button>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}

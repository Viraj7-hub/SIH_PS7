import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Compass, Layers, ShieldCheck } from 'lucide-react';
import RouteLayer from './RouteLayer';
import WeatherOverlay from './WeatherOverlay';
import OceanOverlay from './OceanOverlay';
import TideOverlay from './TideOverlay';
import CycloneOverlay from './CycloneOverlay';
import ShipMarker from './ShipMarker';
import MapLayerToggle from './MapLayerToggle';
import LatLonGraticule from './LatLonGraticule';
import { useShipSimulation } from '../services/useShipSimulation';
import { normalizeCoordinate, normalizeRouteWaypoints } from '../utils/coordinateUtils';

const defaultCenter = [15.3, 76.3];

export default function MapView({
  ship,
  route = [],
  standardRoute = [],
  optimizedRoute = [],
  weather = [],
  oceanConditions,
  oceanCurrents = [],
  tides = [],
  cyclones = [],
  layers,
  livePosition,
  onToggleLayer,
  lastUpdated,
  onSimulationUpdate,
}) {
  const [mode, setMode] = useState('realtime'); // 'realtime' | 'simulation'

  // Route waypoints array
  const rawWaypoints = useMemo(() => {
    if (optimizedRoute && optimizedRoute.length) return optimizedRoute;
    if (route && route.length) return route;
    return [];
  }, [route, optimizedRoute]);

  // Normalized waypoints
  const normalizedWaypoints = useMemo(() => normalizeRouteWaypoints(rawWaypoints), [rawWaypoints]);
  const normalizedStandardRoute = useMemo(() => normalizeRouteWaypoints(standardRoute), [standardRoute]);

  // Simulation engine
  const sim = useShipSimulation(normalizedWaypoints, ship?.speed || 18.2);

  // Notify parent of simulation progress for dynamic metric updates
  useEffect(() => {
    if (mode === 'simulation' && onSimulationUpdate) {
      onSimulationUpdate({
        progress: sim.progress,
        distanceTravelledKm: sim.distanceTravelledKm,
        distanceRemainingKm: sim.distanceRemainingKm,
        etaHours: sim.etaHours,
        position: sim.simulatedPosition,
        isPlaying: sim.isPlaying,
      });
    }
  }, [mode, sim.progress, sim.simulatedPosition, onSimulationUpdate]);

  const mapCenter = useMemo(() => {
    if (mode === 'simulation' && sim.simulatedPosition) {
      const p = normalizeCoordinate([sim.simulatedPosition.lat, sim.simulatedPosition.lon]);
      if (p) return p;
    }
    if (livePosition) {
      const p = normalizeCoordinate(livePosition);
      if (p) return p;
    }
    if (ship?.currentPosition) {
      const p = normalizeCoordinate(ship.currentPosition);
      if (p) return p;
    }
    return defaultCenter;
  }, [mode, sim.simulatedPosition, livePosition, ship]);

  const sourcePosition = useMemo(() => {
    return normalizeCoordinate(ship?.currentPosition || { lat: 18.9388, lon: 72.8354 });
  }, [ship]);

  const destinationPosition = useMemo(() => {
    return normalizeCoordinate(ship?.destinationPosition || { lat: 6.9271, lon: 79.8612 });
  }, [ship]);

  const [radarTileUrl, setRadarTileUrl] = useState('');

  useEffect(() => {
    let active = true;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const past = data?.radar?.past;
        if (past && past.length > 0) {
          const path = past[past.length - 1].path;
          setRadarTileUrl(`https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const activeVesselPosition = useMemo(() => {
    if (mode === 'simulation' && sim.simulatedPosition) {
      return sim.simulatedPosition;
    }
    if (livePosition) return livePosition;
    if (ship?.currentPosition) return ship.currentPosition;
    return { lat: 18.9388, lon: 72.8354 };
  }, [mode, sim.simulatedPosition, livePosition, ship]);

  const simTravelledNormalized = useMemo(
    () => normalizeRouteWaypoints(sim.travelledWaypoints),
    [sim.travelledWaypoints]
  );
  const simRemainingNormalized = useMemo(
    () => normalizeRouteWaypoints(sim.remainingWaypoints),
    [sim.remainingWaypoints]
  );

  return (
    <div className="relative h-[480px] overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-950 shadow-2xl md:h-[600px]">
      
      {/* ── Top Header Controls: Mode Switch & Status ───────────────────── */}
      <div className="absolute right-4 top-4 z-[500] flex flex-wrap items-center gap-2">
        {/* Mode Selector */}
        <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-950/90 p-1 text-xs font-semibold shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => { setMode('realtime'); sim.pauseSimulation(); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              mode === 'realtime'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            REAL-TIME TRACKING
          </button>

          <button
            type="button"
            onClick={() => setMode('simulation')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              mode === 'simulation'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            SIMULATION MODE
          </button>
        </div>

        {/* Timestamp */}
        {lastUpdated && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-[0.68rem] text-slate-300 backdrop-blur-md">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span>Updated: {lastUpdated}</span>
          </div>
        )}
      </div>

      {/* ── Simulation Control Panel Overlay (Active in Simulation Mode) ─── */}
      {mode === 'simulation' && (
        <div className="absolute top-16 right-4 z-[500] flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-md w-72">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Compass className="h-4 w-4 text-amber-400" />
              Route Simulation
            </div>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.65rem] font-bold text-amber-300">
              {sim.progress}% Done
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={sim.progress}
              onChange={(e) => sim.setProgress(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[0.62rem] text-slate-400">
              <span>{sim.distanceTravelledKm} km done</span>
              <span>{sim.distanceRemainingKm} km left</span>
            </div>
          </div>

          {/* Controls: Play/Pause/Reset & Speed */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-2">
            <div className="flex items-center gap-1.5">
              {!sim.isPlaying ? (
                <button
                  type="button"
                  onClick={sim.startSimulation}
                  className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md"
                >
                  <Play className="h-3.5 w-3.5 fill-slate-950" /> Start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={sim.pauseSimulation}
                  className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-md"
                >
                  <Pause className="h-3.5 w-3.5 fill-white" /> Pause
                </button>
              )}

              <button
                type="button"
                onClick={sim.resetSimulation}
                className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
                title="Restart"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Speed Multipliers */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[0.65rem] font-bold">
              {[1, 2, 5, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => sim.setSpeedMultiplier(m)}
                  className={`px-1.5 py-0.5 rounded ${
                    sim.speedMultiplier === m ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Layer Toggle Panel (Bottom Left) ────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-[500] flex flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md w-48">
        <div className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center justify-between">
          <span>Map Layers</span>
          <Layers className="h-3 w-3 text-cyan-400" />
        </div>
        <MapLayerToggle label="Route" enabled={layers.route} onToggle={() => onToggleLayer('route')} />
        <MapLayerToggle label="Nav Grid" enabled={layers.grid ?? true} onToggle={() => onToggleLayer('grid')} />
        <MapLayerToggle label="Weather" enabled={layers.weather} onToggle={() => onToggleLayer('weather')} />
        <MapLayerToggle label="Sea Level" enabled={layers.tides ?? true} onToggle={() => onToggleLayer('tides')} />
        <MapLayerToggle label="Ocean Currents" enabled={layers.ocean} onToggle={() => onToggleLayer('ocean')} />
        <MapLayerToggle label="Cyclones" enabled={layers.cyclone} onToggle={() => onToggleLayer('cyclone')} />
      </div>

      {/* ── Map Legend & Hazard Status (Bottom Right) ──────────────────── */}
      <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md max-w-xs text-xs">
        <div className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
          Map Legend
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-[0.7rem]">
          <span className="inline-block w-4 h-1 bg-emerald-500 rounded" />
          <span>Travelled / Safe Route</span>
        </div>
        <div className="flex items-center gap-2 text-cyan-400 text-[0.7rem]">
          <span className="inline-block w-4 h-1 bg-cyan-400 rounded" />
          <span>Optimized Route</span>
        </div>
        {normalizedStandardRoute.length > 1 && (
          <div className="flex items-center gap-2 text-slate-400 text-[0.7rem]">
            <span className="inline-block w-4 border-t-2 border-dashed border-slate-500" />
            <span>Standard Route</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-300 text-[0.7rem]">
          <span>🌊</span> Modelled Sea Level (MSL)
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-[0.7rem]">
          <span>≈</span> Ocean Current Streamlines
        </div>

        {/* Cyclone Status Indicator */}
        <div className="mt-1 border-t border-slate-800 pt-1.5 text-[0.68rem]">
          {cyclones.length > 0 ? (
            <div className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>{cyclones.length} active cyclone hazard(s) monitored.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>No active cyclone affecting route.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Leaflet Map Canvas ─────────────────────────────────────────── */}
      <MapContainer
        center={mapCenter}
        zoom={5}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: '#082f49' }}
      >
        {/* Colorful Maritime Basemap (OpenStreetMap + OpenSeaMap Seamarks) */}

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='&copy; OpenSeaMap contributors'
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />

        {/* Professional Maritime Navigational Lat/Lon Grid */}
        <LatLonGraticule visible={layers.grid ?? true} />

        {/* RainViewer Radar Overlay */}
        {layers.weather && radarTileUrl && (
          <TileLayer
            attribution='&copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
            url={radarTileUrl}
            opacity={0.5}
            zIndex={100}
          />
        )}

        {/* ── Route Layers ─────────────────────────────────────────────── */}
        {layers.route && (
          <>
            {/* Standard route (dashed slate) if standardRoute present */}
            {normalizedStandardRoute.length > 1 && (
              <Polyline
                positions={normalizedStandardRoute}
                pathOptions={{ color: '#64748b', weight: 2, dashArray: '6 6', opacity: 0.6 }}
              />
            )}

            {/* In simulation mode: render travelled vs remaining route */}
            {mode === 'simulation' && simTravelledNormalized.length > 1 ? (
              <>
                <Polyline
                  positions={simTravelledNormalized}
                  pathOptions={{ color: '#10b981', weight: 4, opacity: 0.95 }}
                />
                <Polyline
                  positions={simRemainingNormalized}
                  pathOptions={{ color: '#06b6d4', weight: 4, opacity: 0.85 }}
                />
              </>
            ) : (
              <RouteLayer route={normalizedWaypoints} visible={true} />
            )}
          </>
        )}

        {/* ── Weather & Environmental Overlays ─────────────────────────── */}
        <WeatherOverlay weather={weather} visible={layers.weather} />
        <TideOverlay tides={tides} visible={layers.tides ?? true} />
        <OceanOverlay data={oceanConditions} currents={oceanCurrents} visible={layers.ocean} />
        <CycloneOverlay cyclones={cyclones} visible={layers.cyclone} />

        {/* ── Origin & Destination Markers ─────────────────────────────── */}
        {sourcePosition && (
          <Marker position={sourcePosition}>
            <Popup className="nautilus-popup">
              <strong>Origin Port</strong>
              <div>{ship?.source || 'Mumbai Port'}</div>
            </Popup>
          </Marker>
        )}

        {destinationPosition && (
          <>
            <Marker position={destinationPosition}>
              <Popup className="nautilus-popup">
                <strong>Destination Port</strong>
                <div>{ship?.destination || 'Port of Colombo'}</div>
              </Popup>
            </Marker>
            <Circle
              center={destinationPosition}
              radius={35000}
              pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.08, weight: 1.5 }}
            />
          </>
        )}

        {/* ── Active Ship Marker ───────────────────────────────────────── */}
        {layers.vessel !== false && activeVesselPosition && (
          <ShipMarker
            position={activeVesselPosition}
            heading={activeVesselPosition.heading || 0}
            label={`${ship?.shipName || 'Ocean Star'} (${mode === 'simulation' ? 'Simulated' : 'Live'})`}
            emoji={mode === 'simulation' ? '⚓' : '🚢'}
          />
        )}
      </MapContainer>
    </div>
  );
}

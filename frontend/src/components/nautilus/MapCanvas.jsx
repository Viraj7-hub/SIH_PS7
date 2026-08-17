import { useState } from 'react';
import MapView from '../MapView';

/**
 * nautilus/MapCanvas.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Colored Maritime Map matching the Main Dashboard.
 * Displays standard & optimized routes, origin/destination ports,
 * layer controls, weather, tides, ocean currents, active cyclones,
 * legend, and interactive ship simulation mode.
 */
export default function MapCanvas({ standardRoute, optimizedRoute, source, destination, loading }) {
  const [layers, setLayers] = useState({
    route: true,
    vessel: true,
    weather: true,
    tides: true,
    ocean: true,
    cyclone: true,
  });

  const toggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const shipData = {
    shipName: 'Nautilus Vessel',
    source: source?.name || 'Origin Port',
    destination: destination?.name || 'Destination Port',
    currentPosition: source ? { lat: source.lat, lon: source.lng } : { lat: 18.9388, lon: 72.8354 },
    destinationPosition: destination ? { lat: destination.lat, lon: destination.lng } : { lat: 6.9271, lon: 79.8612 },
    speed: 18.2,
  };

  const stdWaypoints = standardRoute?.waypoints || [];
  const optWaypoints = optimizedRoute?.waypoints || [];

  return (
    <div className="relative w-full h-full min-h-[460px]">
      <MapView
        ship={shipData}
        route={optWaypoints.length ? optWaypoints : stdWaypoints}
        standardRoute={stdWaypoints}
        optimizedRoute={optWaypoints}
        layers={layers}
        onToggleLayer={toggleLayer}
      />

      {loading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <p className="text-cyan-300 text-sm font-medium tracking-wide">Computing optimal route…</p>
          </div>
        </div>
      )}
    </div>
  );
}

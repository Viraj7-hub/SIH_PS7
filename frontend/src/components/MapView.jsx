import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo, useState, useEffect } from 'react';
import RouteLayer from './RouteLayer';
import WeatherOverlay from './WeatherOverlay';
import OceanOverlay from './OceanOverlay';
import CycloneOverlay from './CycloneOverlay';
import ShipMarker from './ShipMarker';
import MapLayerToggle from './MapLayerToggle';

const defaultCenter = [15.3, 76.3];

export default function MapView({ ship, route, weather, oceanConditions, cyclones, layers, livePosition, onToggleLayer }) {
  const mapCenter = useMemo(() => {
    if (livePosition) return [livePosition.lat, livePosition.lon];
    if (ship?.currentPosition) return [ship.currentPosition.lat, ship.currentPosition.lon];
    return defaultCenter;
  }, [ship, livePosition]);

  const sourcePosition = ship?.currentPosition || { lat: 18.9388, lon: 72.8354 };
  const destinationPosition = ship?.destinationPosition || { lat: 6.9271, lon: 79.8612 };

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
      .catch(() => {
        // Silent catch for network/API load errors to keep the application stable.
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-950 shadow-2xl md:h-[560px]">
      <div className="absolute right-4 top-4 z-[500] flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
        LIVE POSITION
      </div>

      <div className="absolute bottom-4 left-4 z-[500] flex flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/85 p-3 shadow-lg backdrop-blur-sm w-48">
        <div className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Map Layers</div>
        <MapLayerToggle label="Route" enabled={layers.route} onToggle={() => onToggleLayer('route')} />
        <MapLayerToggle label="Weather" enabled={layers.weather} onToggle={() => onToggleLayer('weather')} />
        <MapLayerToggle label="Ocean" enabled={layers.ocean} onToggle={() => onToggleLayer('ocean')} />
        <MapLayerToggle label="Cyclone" enabled={layers.cyclone} onToggle={() => onToggleLayer('cyclone')} />
      </div>

      <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="h-full w-full" style={{ background: '#082f49' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='&copy; OpenSeaMap contributors'
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />

        {layers.weather && radarTileUrl && (
          <TileLayer
            attribution='&copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
            url={radarTileUrl}
            opacity={0.5}
            zIndex={100}
          />
        )}

        <RouteLayer route={route} visible={layers.route} />
        <WeatherOverlay weather={weather} visible={layers.weather} />
        <OceanOverlay data={oceanConditions} visible={layers.ocean} />
        <CycloneOverlay cyclones={cyclones} visible={layers.cyclone} />

        <Marker position={[sourcePosition.lat, sourcePosition.lon]}>
          <Popup>Source - {ship?.source || 'Mumbai Port'}</Popup>
        </Marker>

        <Marker position={[destinationPosition.lat, destinationPosition.lon]}>
          <Popup>Destination - {ship?.destination || 'Port of Colombo'}</Popup>
        </Marker>

        <ShipMarker position={livePosition || ship?.currentPosition} label={`${ship?.shipName || 'Ocean Star'}`} emoji="🚢" />

        <Circle center={[destinationPosition.lat, destinationPosition.lon]} radius={30000} pathOptions={{ color: '#0ea5e9', fillOpacity: 0.08 }} />
      </MapContainer>
    </div>
  );
}

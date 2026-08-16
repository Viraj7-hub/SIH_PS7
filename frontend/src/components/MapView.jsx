import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import RouteLayer from './RouteLayer';
import WeatherOverlay from './WeatherOverlay';
import OceanOverlay from './OceanOverlay';
import CycloneOverlay from './CycloneOverlay';
import ShipMarker from './ShipMarker';

const defaultCenter = [15.3, 76.3];

export default function MapView({ ship, route, weather, oceanConditions, cyclones, layers, livePosition, onToggleLayer }) {
  const mapCenter = useMemo(() => {
    if (livePosition) return [livePosition.lat, livePosition.lon];
    if (ship?.currentPosition) return [ship.currentPosition.lat, ship.currentPosition.lon];
    return defaultCenter;
  }, [ship, livePosition]);

  const sourcePosition = ship?.currentPosition || { lat: 18.9388, lon: 72.8354 };
  const destinationPosition = ship?.destinationPosition || { lat: 6.9271, lon: 79.8612 };

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-950 shadow-2xl md:h-[560px]">
      <div className="absolute right-4 top-4 z-[500] flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
        LIVE POSITION
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

        <RouteLayer route={route} visible={layers.route} />
        <WeatherOverlay weather={weather} visible={layers.weather} />
        <OceanOverlay data={oceanConditions} visible={layers.ocean} />
        <CycloneOverlay cyclones={cyclones} visible={layers.cyclone} />

        <Marker position={[sourcePosition.lat, sourcePosition.lon]}>
          <Popup>Source - Mumbai</Popup>
        </Marker>

        <Marker position={[destinationPosition.lat, destinationPosition.lon]}>
          <Popup>Destination - Colombo</Popup>
        </Marker>

        <ShipMarker position={livePosition || ship?.currentPosition} label={`${ship?.shipName || 'Ocean Star'}`} emoji="🚢" />

        <Circle center={[destinationPosition.lat, destinationPosition.lon]} radius={30000} pathOptions={{ color: '#0ea5e9', fillOpacity: 0.08 }} />
      </MapContainer>
    </div>
  );
}

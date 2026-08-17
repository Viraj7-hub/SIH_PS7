import { Circle, LayerGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Fragment } from 'react';
import { normalizeCoordinate } from '../utils/coordinateUtils';

const cycloneIcon = L.divIcon({
  html: `<div style="
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    background: rgba(15, 23, 42, 0.92);
    border-radius: 50%;
    border: 2px solid #ef4444;
    box-shadow: 0 0 22px rgba(239, 68, 68, 0.7);
  ">🌪️</div>`,
  className: 'custom-div-icon',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -16],
});

export default function CycloneOverlay({ cyclones = [], visible }) {
  if (!visible || !Array.isArray(cyclones) || !cyclones.length) return null;

  return (
    <LayerGroup>
      {cyclones.map((cyclone, index) => {
        const coords = normalizeCoordinate([cyclone.latitude ?? cyclone.lat, cyclone.longitude ?? cyclone.lon]);
        if (!coords) return null;

        const risk = cyclone.riskScore ?? cyclone.risk ?? 50;
        const radius = cyclone.radiusKm ?? 150;
        const timestamp = cyclone.updatedAt || cyclone.detectedAt || new Date().toISOString();

        return (
          <Fragment key={`cyclone-${cyclone.name || 'storm'}-${index}`}>
            <Circle
              center={coords}
              radius={radius * 1000}
              pathOptions={{
                color: risk >= 75 ? '#ef4444' : '#f97316',
                fillColor: risk >= 75 ? '#ef4444' : '#f97316',
                fillOpacity: 0.18,
                weight: 2,
                dashArray: '6 6',
              }}
            />
            <Marker position={coords} icon={cycloneIcon}>
              <Popup className="nautilus-popup">
                <div className="p-1 space-y-1 text-slate-900">
                  <div className="font-bold text-sm text-rose-900 flex items-center gap-1">
                    <span>🌪️</span> {cyclone.name || 'Active Tropical Cyclone'}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    Risk Index: <span className={risk >= 75 ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{risk}/100</span>
                  </div>
                  <div className="text-xs text-slate-700">
                    Wind Warning Field: <span className="font-medium">{radius} km</span>
                  </div>
                  {cyclone.windSpeed != null && (
                    <div className="text-xs text-slate-700">Max Sustained Wind: <span className="font-medium">{cyclone.windSpeed} kn</span></div>
                  )}
                  {cyclone.pressureHpa != null && (
                    <div className="text-xs text-slate-700">Central Pressure: <span className="font-medium">{cyclone.pressureHpa} hPa</span></div>
                  )}
                  {cyclone.category != null && (
                    <div className="text-xs text-slate-700">Intensity: <span className="font-medium">Category {cyclone.category}</span></div>
                  )}
                  <div className="text-[0.65rem] text-slate-500 border-t pt-1 mt-1">
                    <div>Lat: {coords[0].toFixed(2)}°, Lon: {coords[1].toFixed(2)}°</div>
                    <div>Source: GDACS / NOAA Tropical Cyclone Tracker</div>
                    <div>Updated: {typeof timestamp === 'string' ? timestamp.slice(0, 19).replace('T', ' ') : 'Live'}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </LayerGroup>
  );
}

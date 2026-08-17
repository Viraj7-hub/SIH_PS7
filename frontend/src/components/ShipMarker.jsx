import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const createIcon = (emoji, heading = 0) =>
  L.divIcon({
    html: `<div style="
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      background: rgba(14, 165, 233, 0.9);
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 20px rgba(14, 165, 233, 0.8);
      transform: rotate(${heading}deg);
      transition: transform 0.3s ease;
    ">${emoji}</div>`,
    className: 'custom-div-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });

export default function ShipMarker({ position, label, emoji = '🚢', heading = 0 }) {
  if (!position || position.lat == null || position.lon == null) return null;

  const effectiveHeading = position.heading ?? heading ?? 0;

  return (
    <Marker position={[position.lat, position.lon]} icon={createIcon(emoji, effectiveHeading)}>
      <Popup className="nautilus-popup">
        <div className="p-1 space-y-1 text-slate-900">
          <div className="font-bold text-sm text-cyan-900">{label}</div>
          <div className="text-xs text-slate-700">Position: {position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°</div>
          {position.speed != null && (
            <div className="text-xs text-slate-700">Speed: {position.speed.toFixed(1)} knots</div>
          )}
          {effectiveHeading != null && (
            <div className="text-xs text-slate-700">Heading: {effectiveHeading.toFixed(0)}°</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

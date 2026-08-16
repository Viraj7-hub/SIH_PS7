import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const createIcon = (emoji) =>
  L.divIcon({
    html: `<div style="font-size: 18px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(15, 23, 42, 0.8); border-radius: 50%; box-shadow: 0 0 16px rgba(14, 165, 233, 0.5);">${emoji}</div>`,
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });

export default function ShipMarker({ position, label, emoji = '🚢' }) {
  if (!position) return null;

  return (
    <Marker position={[position.lat, position.lon]} icon={createIcon(emoji)}>
      <Popup>{label}</Popup>
    </Marker>
  );
}

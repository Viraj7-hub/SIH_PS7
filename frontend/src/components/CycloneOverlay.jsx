import { Circle, LayerGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Fragment } from 'react';

const cycloneIcon = L.divIcon({
  html: '<div style="font-size: 18px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(15, 23, 42, 0.82); border-radius: 50%; box-shadow: 0 0 18px rgba(251, 146, 60, 0.5);">🌪️</div>',
  className: 'custom-div-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -12],
});

export default function CycloneOverlay({ cyclones = [], visible }) {
  if (!visible || !cyclones.length) return null;

  return (
    <LayerGroup>
      {cyclones.map((cyclone, index) => (
        <Fragment key={`${cyclone.name}-${index}`}>
          <Circle
            center={[cyclone.lat, cyclone.lon]}
            radius={cyclone.radiusKm * 1000}
            pathOptions={{
              color: cyclone.risk >= 75 ? '#ef4444' : '#f97316',
              fillColor: cyclone.risk >= 75 ? '#ef4444' : '#f97316',
              fillOpacity: 0.12,
              weight: 1.6,
            }}
          />
          <Marker position={[cyclone.lat, cyclone.lon]} icon={cycloneIcon}>
            <Popup>
              <div>
                <strong>{cyclone.name}</strong>
                <div>Risk: {cyclone.risk}%</div>
                <div>Radius: {cyclone.radiusKm} km</div>
              </div>
            </Popup>
          </Marker>
        </Fragment>
      ))}
    </LayerGroup>
  );
}

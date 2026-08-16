import { CircleMarker, Popup, LayerGroup } from 'react-leaflet';

export default function OceanOverlay({ data, visible }) {
  if (!visible || !data) return null;

  return (
    <LayerGroup>
      <CircleMarker center={[15.2, 75.8]} radius={10} pathOptions={{ color: '#38bdf8', fillColor: '#7dd3fc', fillOpacity: 0.3 }}>
        <Popup>
          <div>
            <strong>Ocean Conditions</strong>
            <div>Wave Height: {data.waveHeight} m</div>
            <div>Current: {data.currentSpeed} knots</div>
            <div>Direction: {data.currentDirection}°</div>
          </div>
        </Popup>
      </CircleMarker>
    </LayerGroup>
  );
}

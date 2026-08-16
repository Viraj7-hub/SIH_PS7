import { Circle, LayerGroup, Popup } from 'react-leaflet';

const riskColors = {
  low: '#22c55e',
  moderate: '#facc15',
  high: '#f97316',
  severe: '#ef4444',
};

const getRiskColor = (risk) => {
  if (risk >= 75) return riskColors.severe;
  if (risk >= 50) return riskColors.high;
  if (risk >= 30) return riskColors.moderate;
  return riskColors.low;
};

export default function WeatherOverlay({ weather = [], visible }) {
  if (!visible || !weather.length) return null;

  return (
    <LayerGroup>
      {weather.map((point, index) => (
        <Circle
          key={`${point.lat}-${point.lon}-${index}`}
          center={[point.lat, point.lon]}
          radius={18000 + point.risk * 150}
          pathOptions={{
            color: getRiskColor(point.risk),
            fillColor: getRiskColor(point.risk),
            fillOpacity: 0.18,
            weight: 1.6,
          }}
        >
          <Popup>
            <div>
              <strong>Weather Condition</strong>
              <div>{point.condition}</div>
              <div>Risk: {point.risk}%</div>
            </div>
          </Popup>
        </Circle>
      ))}
    </LayerGroup>
  );
}

import { Circle, LayerGroup, Popup } from 'react-leaflet';
import { normalizeCoordinate } from '../utils/coordinateUtils';

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
  if (!visible || !Array.isArray(weather) || !weather.length) return null;

  return (
    <LayerGroup>
      {weather.map((point, index) => {
        const coords = normalizeCoordinate([point.lat ?? point.latitude, point.lon ?? point.longitude]);
        if (!coords) return null;

        const risk = point.risk ?? point.riskScore ?? 20;

        return (
          <Circle
            key={`wx-${coords[0]}-${coords[1]}-${index}`}
            center={coords}
            radius={18000 + risk * 150}
            pathOptions={{
              color: getRiskColor(risk),
              fillColor: getRiskColor(risk),
              fillOpacity: 0.18,
              weight: 1.6,
            }}
          >
            <Popup className="nautilus-popup">
              <div className="p-1 space-y-1 text-slate-900">
                <div className="font-bold text-sm text-slate-900 flex items-center gap-1">
                  <span>🌤️</span> Marine Weather Condition
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  Status: <span className="font-bold text-cyan-700">{point.condition || 'Moderate'}</span>
                </div>
                {point.windSpeed != null && (
                  <div className="text-xs text-slate-700">Wind: <span className="font-medium">{point.windSpeed} kn</span></div>
                )}
                {point.waveHeight != null && (
                  <div className="text-xs text-slate-700">Waves: <span className="font-medium">{point.waveHeight} m</span></div>
                )}
                {point.temperature != null && (
                  <div className="text-xs text-slate-700">Air Temp: <span className="font-medium">{point.temperature} °C</span></div>
                )}
                <div className="text-xs font-semibold text-slate-700">
                  Risk Score: <span className="font-bold" style={{ color: getRiskColor(risk) }}>{risk}/100</span>
                </div>
                <div className="text-[0.65rem] text-slate-500 border-t pt-1 mt-1">
                  Source: {point.source || 'Open-Meteo Marine & Forecast API'}
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </LayerGroup>
  );
}

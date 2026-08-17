import { Marker, Popup, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { normalizeCoordinate } from '../utils/coordinateUtils';

const tideIcon = L.divIcon({
  html: `<div style="
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: rgba(14, 165, 233, 0.88);
    color: #fff;
    border-radius: 50%;
    border: 2px solid #ffffff;
    box-shadow: 0 0 14px rgba(14, 165, 233, 0.65);
  ">🌊</div>`,
  className: 'custom-div-icon',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -10],
});

export default function TideOverlay({ tides = [], visible }) {
  if (!visible || !Array.isArray(tides) || !tides.length) return null;

  return (
    <LayerGroup>
      {tides.map((station, index) => {
        const coords = normalizeCoordinate([station.lat ?? station.latitude, station.lon ?? station.longitude]);
        if (!coords) return null;

        return (
          <Marker key={`tide-${station.stationName}-${index}`} position={coords} icon={tideIcon}>
            <Popup className="nautilus-popup">
              <div className="p-1 space-y-1 text-slate-900">
                <div className="font-bold text-sm text-cyan-800 flex items-center gap-1">
                  <span>🌊</span> {station.stationName || 'Coastal Station'}
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  Modelled Sea Level: <span className="text-cyan-700 font-bold">{station.currentTideLevel || '+0.45 m MSL'}</span>
                </div>
                <div className="text-[0.7rem] inline-block px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-medium">
                  {station.state || 'Rising (Flood)'}
                </div>
                <div className="text-[0.7rem] text-slate-600 mt-1">
                  <div>{station.nextHighTide || 'High: +1.4m'}</div>
                  <div>{station.nextLowTide || 'Low: -0.3m'}</div>
                </div>
                <div className="text-[0.65rem] text-slate-600 border-t pt-1 mt-1">
                  <div>Lat: {coords[0].toFixed(2)}°, Lon: {coords[1].toFixed(2)}°</div>
                  <div>Data Type: Modelled Sea Level (MSL)</div>
                  <div>Source: Open-Meteo Marine Sea Level Model</div>
                  <div>Updated: {station.updatedAt ? station.updatedAt.slice(0, 19).replace('T', ' ') : 'Live'}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </LayerGroup>
  );
}

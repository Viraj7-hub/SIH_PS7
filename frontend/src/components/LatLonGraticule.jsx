import { useEffect, useState } from 'react';
import { useMap, Polyline, Marker, LayerGroup } from 'react-leaflet';
import L from 'leaflet';

function formatLat(lat) {
  if (Math.abs(lat) < 0.001) return '0°';
  return lat > 0 ? `${lat.toFixed(0)}°N` : `${Math.abs(lat).toFixed(0)}°S`;
}

function formatLng(lng) {
  if (Math.abs(lng) < 0.001) return '0°';
  return lng > 0 ? `${lng.toFixed(0)}°E` : `${Math.abs(lng).toFixed(0)}°W`;
}

function createLabelIcon(text) {
  return L.divIcon({
    className: '',
    html: `<div style="
      font-size: 10px;
      font-weight: 600;
      color: rgba(56, 189, 248, 0.7);
      background: rgba(2, 6, 23, 0.65);
      padding: 1px 4px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      font-family: monospace;
      border: 1px solid rgba(56, 189, 248, 0.2);
    ">${text}</div>`,
    iconSize: [0, 0],
    iconAnchor: [12, 8],
  });
}

export default function LatLonGraticule({ visible = true }) {
  const map = useMap();
  const [gridData, setGridData] = useState({ latLines: [], lngLines: [], labels: [] });

  useEffect(() => {
    if (!map || !visible) return;

    const updateGrid = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const south = Math.max(-85, bounds.getSouth());
      const north = Math.min(85, bounds.getNorth());
      const west = Math.max(-180, bounds.getWest());
      const east = Math.min(180, bounds.getEast());

      let step = 10;
      if (zoom >= 8) step = 1;
      else if (zoom >= 6) step = 2;
      else if (zoom >= 4) step = 5;

      const latLines = [];
      const lngLines = [];
      const labels = [];

      // Start / End rounded to step multiples
      const startLat = Math.floor(south / step) * step;
      const endLat = Math.ceil(north / step) * step;
      const startLng = Math.floor(west / step) * step;
      const endLng = Math.ceil(east / step) * step;

      // Latitude lines (parallel lines across longitudes)
      for (let lat = startLat; lat <= endLat; lat += step) {
        if (lat >= -85 && lat <= 85) {
          latLines.push([
            [lat, west - 2],
            [lat, east + 2],
          ]);
          // Label near west margin
          labels.push({ pos: [lat, west + (east - west) * 0.05], text: formatLat(lat) });
        }
      }

      // Longitude lines (meridian lines across latitudes)
      for (let lng = startLng; lng <= endLng; lng += step) {
        if (lng >= -180 && lng <= 180) {
          lngLines.push([
            [south - 2, lng],
            [north + 2, lng],
          ]);
          // Label near south margin
          labels.push({ pos: [south + (north - south) * 0.05, lng], text: formatLng(lng) });
        }
      }

      setGridData({ latLines, lngLines, labels });
    };

    updateGrid();

    map.on('moveend zoomend', updateGrid);
    return () => {
      map.off('moveend zoomend', updateGrid);
    };
  }, [map, visible]);

  if (!visible) return null;

  return (
    <LayerGroup>
      {/* Latitude lines */}
      {gridData.latLines.map((line, idx) => (
        <Polyline
          key={`lat-line-${idx}`}
          positions={line}
          pathOptions={{
            color: '#38bdf8',
            weight: 1,
            opacity: 0.22,
            dashArray: '3 6',
          }}
        />
      ))}

      {/* Longitude lines */}
      {gridData.lngLines.map((line, idx) => (
        <Polyline
          key={`lng-line-${idx}`}
          positions={line}
          pathOptions={{
            color: '#38bdf8',
            weight: 1,
            opacity: 0.22,
            dashArray: '3 6',
          }}
        />
      ))}

      {/* Graticule labels */}
      {gridData.labels.map((lbl, idx) => (
        <Marker key={`grat-lbl-${idx}`} position={lbl.pos} icon={createLabelIcon(lbl.text)} interactive={false} />
      ))}
    </LayerGroup>
  );
}

import { Polyline } from 'react-leaflet';
import { normalizeRouteWaypoints } from '../utils/coordinateUtils';

export default function RouteLayer({ route, visible }) {
  if (!visible || !Array.isArray(route)) return null;

  const positions = normalizeRouteWaypoints(route);
  if (positions.length < 2) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#38bdf8',
        weight: 4,
        opacity: 0.9,
        dashArray: '10 12',
      }}
    />
  );
}

import { Polyline } from 'react-leaflet';

export default function RouteLayer({ route, visible }) {
  if (!visible || !Array.isArray(route) || route.length < 2) return null;

  const positions = route.map((point) => [point.lat, point.lon]);

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

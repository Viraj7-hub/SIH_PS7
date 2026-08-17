import { useEffect, useRef } from 'react';
import { useMap, LayerGroup, CircleMarker, Popup } from 'react-leaflet';
import { normalizeCoordinate } from '../utils/coordinateUtils';

/**
 * Animated Streamline Flow Field for Ocean Currents.
 * Renders high-performance 60fps flowing particle streamlines along real
 * ocean current vector directions and speeds over open ocean water.
 */
export default function OceanOverlay({ currents = [], visible }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!visible || !Array.isArray(currents) || !currents.length || !map) {
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
      return;
    }

    // Create canvas over Leaflet map pane
    const pane = map.getPane('overlayPane');
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '350';
      pane.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext('2d');

    // Resize canvas to map pixel dimensions
    const resetCanvasSize = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      canvas.style.transform = `translate3d(${topLeft.x}px, ${topLeft.y}px, 0px)`;
    };

    resetCanvasSize();

    // Validated vector points with map pixel coordinates
    const getVectors = () => {
      return currents
        .map((pt) => {
          const coords = normalizeCoordinate([pt.lat ?? pt.latitude, pt.lon ?? pt.longitude]);
          if (!coords) return null;

          const layerPoint = map.latLngToContainerPoint(coords);
          const dirDeg = pt.currentDirection ?? 0;
          const speed = pt.currentSpeed ?? 1.0;

          // Convert direction (meteorological 0° = North) to math angle in radians
          const rad = ((90 - dirDeg) * Math.PI) / 180;
          const vx = Math.cos(rad) * (speed * 1.6 + 0.8);
          const vy = -Math.sin(rad) * (speed * 1.6 + 0.8);

          return {
            x: layerPoint.x,
            y: layerPoint.y,
            vx,
            vy,
            speed,
            dirDeg,
          };
        })
        .filter(Boolean);
    };

    let vectors = getVectors();

    // Spawn 120 particle streams initialized around vector positions
    const numParticles = 140;
    const particles = [];

    const resetParticle = (p, vecList) => {
      if (!vecList.length) return;
      const parent = vecList[Math.floor(Math.random() * vecList.length)];
      p.x = parent.x + (Math.random() - 0.5) * 40;
      p.y = parent.y + (Math.random() - 0.5) * 40;
      p.vx = parent.vx;
      p.vy = parent.vy;
      p.speed = parent.speed;
      p.age = 0;
      p.maxAge = 40 + Math.random() * 40;
    };

    for (let i = 0; i < numParticles; i++) {
      const p = {};
      resetParticle(p, vectors);
      particles.push(p);
    }

    // Animation Loop
    let lastTime = Date.now();
    const render = () => {
      const now = Date.now();
      if (now - lastTime > 30) {
        lastTime = now;

        // Subtle semi-transparent clear for smooth trailing streamlines
        ctx.fillStyle = 'rgba(2, 6, 23, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);

          p.x += p.vx;
          p.y += p.vy;
          p.age++;

          ctx.lineTo(p.x, p.y);

          // Color based on current speed
          if (p.speed >= 2.0) {
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)'; // Orange/Red (fast current)
          } else if (p.speed >= 1.0) {
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.80)'; // Yellow (moderate current)
          } else {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)'; // Cyan (light current)
          }

          ctx.lineWidth = 1.6;
          ctx.stroke();

          if (p.age > p.maxAge || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
            resetParticle(p, vectors);
          }
        });
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    const handleMapMove = () => {
      resetCanvasSize();
      vectors = getVectors();
      particles.forEach((p) => resetParticle(p, vectors));
    };

    map.on('move zoom', handleMapMove);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.off('move zoom', handleMapMove);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
        canvasRef.current = null;
      }
    };
  }, [map, visible, currents]);

  if (!visible || !Array.isArray(currents) || !currents.length) return null;

  return (
    <LayerGroup>
      {/* Station observation popups */}
      {currents.map((pt, idx) => {
        const coords = normalizeCoordinate([pt.lat ?? pt.latitude, pt.lon ?? pt.longitude]);
        if (!coords) return null;

        return (
          <CircleMarker
            key={`oc-station-${coords[0]}-${coords[1]}-${idx}`}
            center={coords}
            radius={4}
            pathOptions={{
              color: '#38bdf8',
              fillColor: '#0ea5e9',
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup className="nautilus-popup">
              <div className="p-1 space-y-1 text-slate-900">
                <div className="font-bold text-sm text-cyan-900 flex items-center gap-1">
                  <span>≈</span> Ocean Current Observation
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  Current Speed: <span className="font-bold text-cyan-700">{pt.currentSpeed} kn</span>
                </div>
                <div className="text-xs text-slate-700">
                  Direction: <span className="font-medium">{pt.currentDirection}°</span>
                </div>
                {pt.waveHeight != null && (
                  <div className="text-xs text-slate-700">Wave Height: <span className="font-medium">{pt.waveHeight} m</span></div>
                )}
                {pt.seaTemperature != null && (
                  <div className="text-xs text-slate-700">Sea Temp: <span className="font-medium">{pt.seaTemperature} °C</span></div>
                )}
                <div className="text-[0.65rem] text-slate-500 border-t pt-1 mt-1">
                  <div>Lat: {coords[0].toFixed(2)}°, Lon: {coords[1].toFixed(2)}°</div>
                  <div>Source: {pt.source || 'Open-Meteo Ocean Current Grid'}</div>
                  <div>Updated: {typeof pt.updatedAt === 'string' ? pt.updatedAt.slice(0, 19).replace('T', ' ') : 'Live'}</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}

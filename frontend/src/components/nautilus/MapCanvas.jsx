import { useEffect, useRef, useState } from 'react';

/**
 * nautilus/MapCanvas.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Interactive Leaflet map showing:
 *   • Standard route  — dashed grey/blue polyline
 *   • Optimized route — solid cyan/teal polyline
 *   • Source / destination port markers
 *   • Intermediate waypoint dots
 *   • Animated vessel icon on optimized path midpoint
 *
 * Uses Leaflet loaded from CDN — no extra npm package needed
 * (Leaflet is already referenced in the project via MapView.jsx).
 */

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '© OpenStreetMap © CARTO';

function buildIcon(L, color, size = 10) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 6px ${color};"></div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildPortIcon(L, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:rgba(14,165,233,0.9);color:#fff;
      padding:3px 8px;border-radius:20px;
      font-size:11px;font-weight:700;white-space:nowrap;
      border:1px solid rgba(255,255,255,0.3);
      box-shadow:0 2px 8px rgba(14,165,233,0.5);
      font-family:Inter,sans-serif;">${label}</div>`,
    iconSize:   [0, 0],
    iconAnchor: [0, -6],
  });
}

export default function MapCanvas({ standardRoute, optimizedRoute, source, destination, loading }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const layersRef  = useRef({ std: null, opt: null, markers: [] });

  // Initialize map once
  useEffect(() => {
    if (leafletRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center:    [10, 80],
      zoom:      4,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18, subdomains: 'abcd' }).addTo(map);

    leafletRef.current = { map, L };
    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // Draw / redraw routes when data changes
  useEffect(() => {
    if (!leafletRef.current) return;
    const { map, L } = leafletRef.current;

    // Remove old layers
    if (layersRef.current.std)    { map.removeLayer(layersRef.current.std); }
    if (layersRef.current.opt)    { map.removeLayer(layersRef.current.opt); }
    layersRef.current.markers.forEach((m) => map.removeLayer(m));
    layersRef.current.markers = [];

    if (!standardRoute && !optimizedRoute) return;

    const bounds = L.latLngBounds();

    // Standard route — dashed slate
    if (standardRoute?.waypoints?.length > 1) {
      const line = L.polyline(standardRoute.waypoints, {
        color:     '#64748b',
        weight:    2,
        opacity:   0.6,
        dashArray: '8 6',
      }).addTo(map);
      layersRef.current.std = line;
      standardRoute.waypoints.forEach(([lat, lng]) => bounds.extend([lat, lng]));

      line.bindTooltip(
        `Standard Route: ${standardRoute.distanceNM?.toFixed(0)} NM · ${standardRoute.durationHrs?.toFixed(1)} hrs · ${standardRoute.fuelTons?.toFixed(1)} t fuel`,
        { sticky: true, className: 'nautilus-tooltip' }
      );
    }

    // Optimized route — solid cyan
    if (optimizedRoute?.waypoints?.length > 1) {
      const line = L.polyline(optimizedRoute.waypoints, {
        color:   '#06b6d4',
        weight:  3,
        opacity: 0.9,
      }).addTo(map);
      layersRef.current.opt = line;
      optimizedRoute.waypoints.forEach(([lat, lng]) => bounds.extend([lat, lng]));

      line.bindTooltip(
        `Optimized Route: ${optimizedRoute.distanceNM?.toFixed(0)} NM · ${optimizedRoute.durationHrs?.toFixed(1)} hrs · ${optimizedRoute.fuelTons?.toFixed(1)} t fuel`,
        { sticky: true, className: 'nautilus-tooltip' }
      );

      // Waypoint dots along optimized route (skip start and end)
      const wps = optimizedRoute.waypoints;
      for (let i = 1; i < wps.length - 1; i++) {
        const dot = L.marker(wps[i], { icon: buildIcon(L, '#06b6d4', 6), zIndexOffset: 100 }).addTo(map);
        layersRef.current.markers.push(dot);
      }
    }

    // Source marker
    if (source) {
      const sm = L.marker([source.lat, source.lng], {
        icon: buildIcon(L, '#22c55e', 14),
        zIndexOffset: 500,
      }).addTo(map);
      sm.bindPopup(`<b>${source.name}</b><br/>Origin`, { className: 'nautilus-popup' });
      const lbl = L.marker([source.lat, source.lng], {
        icon: buildPortIcon(L, `◎ ${source.name}`),
        zIndexOffset: 600,
      }).addTo(map);
      layersRef.current.markers.push(sm, lbl);
      bounds.extend([source.lat, source.lng]);
    }

    // Destination marker
    if (destination) {
      const dm = L.marker([destination.lat, destination.lng], {
        icon: buildIcon(L, '#f59e0b', 14),
        zIndexOffset: 500,
      }).addTo(map);
      dm.bindPopup(`<b>${destination.name}</b><br/>Destination`, { className: 'nautilus-popup' });
      const lbl = L.marker([destination.lat, destination.lng], {
        icon: buildPortIcon(L, `⚓ ${destination.name}`),
        zIndexOffset: 600,
      }).addTo(map);
      layersRef.current.markers.push(dm, lbl);
      bounds.extend([destination.lat, destination.lng]);
    }

    // Fit map to routes
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7, animate: true });
    }
  }, [standardRoute, optimizedRoute, source, destination]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-700/60"
         style={{ minHeight: 420 }}>
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: 420 }} />

      {/* Legend */}
      {(standardRoute || optimizedRoute) && (
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1.5
                        rounded-xl border border-slate-700/70 bg-slate-900/90
                        px-3 py-2.5 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-block w-6 border-t-2 border-dashed border-slate-500" />
            Standard Route
          </div>
          <div className="flex items-center gap-2 text-cyan-300">
            <span className="inline-block w-6 border-t-2 border-cyan-400" />
            Optimized Route
          </div>
          <div className="flex items-center gap-2 text-green-300 mt-1">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500 border border-white" />
            Origin
          </div>
          <div className="flex items-center gap-2 text-amber-300">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-400 border border-white" />
            Destination
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center
                        bg-slate-950/70 backdrop-blur-sm rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <p className="text-cyan-300 text-sm font-medium tracking-wide">Computing optimal route…</p>
          </div>
        </div>
      )}
    </div>
  );
}

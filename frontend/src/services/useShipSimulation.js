import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Calculates Haversine distance in km between two [lat, lon] points.
 */
function haversineKm(p1, p2) {
  const R = 6371; // Earth radius in km
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1[0] * Math.PI) / 180) *
      Math.cos((p2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates bearing angle (0-360 deg) from point 1 to point 2.
 */
function calculateBearing(p1, p2) {
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export function useShipSimulation(rawWaypoints = [], baseSpeedKnots = 18.2) {
  const waypoints = useMemo(() => {
    if (!rawWaypoints || !rawWaypoints.length) return [];
    return rawWaypoints.map((wp) => (Array.isArray(wp) ? wp : [wp.lat, wp.lon ?? wp.lng]));
  }, [rawWaypoints]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x, 2x, 5x, 10x

  // Pre-calculate segment distances and total distance
  const { segments, totalDistanceKm } = useMemo(() => {
    if (waypoints.length < 2) return { segments: [], totalDistanceKm: 0 };
    let total = 0;
    const segs = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dist = haversineKm(waypoints[i], waypoints[i + 1]);
      segs.push({
        from: waypoints[i],
        to: waypoints[i + 1],
        distance: dist,
        startKm: total,
        endKm: total + dist,
        bearing: calculateBearing(waypoints[i], waypoints[i + 1]),
      });
      total += dist;
    }
    return { segments: segs, totalDistanceKm: total };
  }, [waypoints]);

  // Compute current state based on progress %
  const currentKm = (progress / 100) * totalDistanceKm;

  const currentSegment = useMemo(() => {
    if (!segments.length) return null;
    if (currentKm <= 0) return segments[0];
    if (currentKm >= totalDistanceKm) return segments[segments.length - 1];
    return segments.find((s) => currentKm >= s.startKm && currentKm <= s.endKm) || segments[0];
  }, [segments, currentKm, totalDistanceKm]);

  // Current interpolated position
  const simulatedPosition = useMemo(() => {
    if (!currentSegment) {
      if (waypoints.length) return { lat: waypoints[0][0], lon: waypoints[0][1], heading: 0, speed: baseSpeedKnots };
      return null;
    }
    const segDist = currentSegment.distance || 0.001;
    const frac = Math.max(0, Math.min(1, (currentKm - currentSegment.startKm) / segDist));
    const lat = currentSegment.from[0] + frac * (currentSegment.to[0] - currentSegment.from[0]);
    const lon = currentSegment.from[1] + frac * (currentSegment.to[1] - currentSegment.from[1]);

    return {
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat(lon.toFixed(6)),
      heading: parseFloat(currentSegment.bearing.toFixed(1)),
      speed: baseSpeedKnots * speedMultiplier,
    };
  }, [currentSegment, currentKm, waypoints, baseSpeedKnots, speedMultiplier]);

  // Split waypoints into travelled vs remaining for route rendering
  const { travelledWaypoints, remainingWaypoints } = useMemo(() => {
    if (!waypoints.length || !simulatedPosition) return { travelledWaypoints: [], remainingWaypoints: waypoints };

    const travelled = [];
    const remaining = [];
    let passedCurrent = false;

    if (currentSegment) {
      for (const seg of segments) {
        if (seg.endKm <= currentKm) {
          if (!travelled.length) travelled.push(seg.from);
          travelled.push(seg.to);
        } else if (!passedCurrent) {
          if (!travelled.length) travelled.push(seg.from);
          travelled.push([simulatedPosition.lat, simulatedPosition.lon]);
          remaining.push([simulatedPosition.lat, simulatedPosition.lon]);
          remaining.push(seg.to);
          passedCurrent = true;
        } else {
          remaining.push(seg.to);
        }
      }
    }

    return {
      travelledWaypoints: travelled.length ? travelled : [[simulatedPosition.lat, simulatedPosition.lon]],
      remainingWaypoints: remaining.length ? remaining : waypoints,
    };
  }, [waypoints, segments, currentKm, simulatedPosition, currentSegment]);

  // Distance metrics
  const distanceTravelledKm = Math.min(totalDistanceKm, currentKm);
  const distanceRemainingKm = Math.max(0, totalDistanceKm - currentKm);

  // ETA calculation
  const speedKmH = (baseSpeedKnots * 1.852) * speedMultiplier;
  const etaHours = speedKmH > 0 ? distanceRemainingKm / speedKmH : 0;

  // Animation Loop
  const animRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    if (!isPlaying || totalDistanceKm <= 0) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Speed in km/s (scaled for visual demo speed)
      // 1x = ~100 km per real second for smooth visualization
      const speedKmPerSec = (baseSpeedKnots * 1.852 * speedMultiplier * 15) / 3600;
      const advanceKm = speedKmPerSec * deltaSec;

      setProgress((prev) => {
        const nextKm = (prev / 100) * totalDistanceKm + advanceKm;
        const nextPct = (nextKm / totalDistanceKm) * 100;

        if (nextPct >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return nextPct;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, totalDistanceKm, baseSpeedKnots, speedMultiplier]);

  return {
    isPlaying,
    progress: parseFloat(progress.toFixed(2)),
    speedMultiplier,
    simulatedPosition,
    travelledWaypoints,
    remainingWaypoints,
    distanceTravelledKm: parseFloat(distanceTravelledKm.toFixed(1)),
    distanceRemainingKm: parseFloat(distanceRemainingKm.toFixed(1)),
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(1)),
    etaHours: parseFloat(etaHours.toFixed(2)),
    startSimulation: () => {
      if (progress >= 100) setProgress(0);
      setIsPlaying(true);
    },
    pauseSimulation: () => setIsPlaying(false),
    resetSimulation: () => {
      setIsPlaying(false);
      setProgress(0);
    },
    setSpeedMultiplier,
    setProgress,
  };
}

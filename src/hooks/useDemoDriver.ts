import { useEffect, useRef, useState } from 'react';

/**
 * Simulerar GPS längs en rutt. Kör med given hastighetsmultiplikator (default 10×).
 * Returnerar position + isRunning. Anrop start()/stop() via funktioner.
 */
export function useDemoDriver(
  routePoints: [number, number][] | undefined,
  active: boolean,
  speedMultiplier = 10,
): { position: { lat: number; lng: number } | null; progress: number } {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const totalDistanceRef = useRef(0);
  const distancesRef = useRef<number[]>([]);

  // Pre-compute cumulative distances along route in meters.
  useEffect(() => {
    if (!routePoints || routePoints.length < 2) {
      distancesRef.current = [];
      totalDistanceRef.current = 0;
      return;
    }
    const cum: number[] = [0];
    let total = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const [lng1, lat1] = routePoints[i - 1];
      const [lng2, lat2] = routePoints[i];
      const R = 6371000;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += d;
      cum.push(total);
    }
    distancesRef.current = cum;
    totalDistanceRef.current = total;
  }, [routePoints]);

  useEffect(() => {
    if (!active || !routePoints || routePoints.length < 2) {
      startTimeRef.current = null;
      setProgress(0);
      return;
    }
    startTimeRef.current = performance.now();
    // Assume 80 km/h average ≈ 22.2 m/s. Multiply by speedMultiplier.
    const baseSpeed = 22.2; // m/s
    const speed = baseSpeed * speedMultiplier;

    let raf: number;
    const tick = () => {
      const start = startTimeRef.current;
      if (start === null) return;
      const elapsedSec = (performance.now() - start) / 1000;
      let dist = elapsedSec * speed;
      const total = totalDistanceRef.current;
      if (dist >= total) {
        dist = total;
      }
      setProgress(total > 0 ? dist / total : 0);

      // Find segment via binary search
      const cum = distancesRef.current;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < dist) lo = mid + 1;
        else hi = mid;
      }
      const i = Math.max(1, lo);
      const segDist = cum[i] - cum[i - 1];
      const t = segDist > 0 ? (dist - cum[i - 1]) / segDist : 0;
      const [lng1, lat1] = routePoints[i - 1];
      const [lng2, lat2] = routePoints[i];
      setPosition({
        lat: lat1 + (lat2 - lat1) * t,
        lng: lng1 + (lng2 - lng1) * t,
      });

      if (dist < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      startTimeRef.current = null;
    };
  }, [active, routePoints, speedMultiplier]);

  return { position, progress };
}

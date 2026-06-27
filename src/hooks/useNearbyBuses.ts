import { useState, useEffect, useCallback } from 'react';
import { getBusPositions } from '../services/sptrans';
import { NEARBY_RADIUS_KM, REFRESH_INTERVAL_MS } from '../constants/config';
import type { BusPosition, Coordinates } from '../types';

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useNearbyBuses(center: Coordinates, radiusKm = NEARBY_RADIUS_KM) {
  const [buses, setBuses] = useState<BusPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getBusPositions();
      const nearby = all.filter((line) =>
        line.vs.some(
          (v) =>
            haversineKm(center, { latitude: v.py, longitude: v.px }) <= radiusKm
        )
      );
      setBuses(nearby);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao buscar ônibus');
    } finally {
      setLoading(false);
    }
  }, [center, radiusKm]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { buses, loading, error, refresh };
}

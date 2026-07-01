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
  const [total, setTotal] = useState(0); // total de veículos recebidos da API (cidade toda)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getBusPositions();
      const totalVehicles = all.reduce((acc, line) => acc + line.vs.length, 0);
      setTotal(totalVehicles);

      // Mantém em cada linha só os veículos dentro do raio (não a linha inteira).
      const nearby = all
        .map((line) => ({
          ...line,
          vs: line.vs.filter(
            (v) =>
              haversineKm(center, { latitude: v.py, longitude: v.px }) <= radiusKm
          ),
        }))
        .filter((line) => line.vs.length > 0);
      setBuses(nearby);

      if (totalVehicles === 0) {
        setError('Sem resposta da API. Toque em 🔍 Diagnóstico na aba Config.');
      }
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

  return { buses, total, loading, error, refresh };
}

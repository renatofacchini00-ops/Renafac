import { useState, useEffect, useCallback } from 'react';
import { getBusPositionsByLine, getStopsByLine } from '../services/sptrans';
import { REFRESH_INTERVAL_MS } from '../constants/config';
import type { BusStop, BusVehicle } from '../types';

// Rastreia, em tempo real, todos os ônibus de uma linha específica e carrega
// as paradas dela (para desenhar o trajeto). Passe null para desligar.
export function useLineTracking(codigoLinha: number | null) {
  const [vehicles, setVehicles] = useState<BusVehicle[]>([]);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (codigoLinha == null) return;
    setLoading(true);
    try {
      const pos = await getBusPositionsByLine(codigoLinha);
      setVehicles(pos?.vs ?? []);
    } finally {
      setLoading(false);
    }
  }, [codigoLinha]);

  useEffect(() => {
    if (codigoLinha == null) {
      setVehicles([]);
      setStops([]);
      return;
    }
    // paradas: carrega uma vez (o trajeto não muda)
    getStopsByLine(codigoLinha)
      .then(setStops)
      .catch(() => setStops([]));

    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [codigoLinha, refresh]);

  return { vehicles, stops, loading, refresh };
}

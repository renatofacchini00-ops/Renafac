import { useState, useEffect, useCallback } from 'react';
import {
  getFavoriteRoutes,
  saveFavoriteRoute,
  removeFavoriteRoute,
  getFavoriteStops,
  saveFavoriteStop,
  removeFavoriteStop,
} from '../services/storage';
import type { FavoriteRoute, FavoriteStop } from '../types';

export function useFavorites() {
  const [routes, setRoutes] = useState<FavoriteRoute[]>([]);
  const [stops, setStops] = useState<FavoriteStop[]>([]);

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([getFavoriteRoutes(), getFavoriteStops()]);
    setRoutes(r);
    setStops(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRoute = useCallback(
    async (route: FavoriteRoute) => {
      await saveFavoriteRoute(route);
      await load();
    },
    [load]
  );

  const deleteRoute = useCallback(
    async (id: string) => {
      await removeFavoriteRoute(id);
      await load();
    },
    [load]
  );

  const addStop = useCallback(
    async (stop: FavoriteStop) => {
      await saveFavoriteStop(stop);
      await load();
    },
    [load]
  );

  const deleteStop = useCallback(
    async (id: string) => {
      await removeFavoriteStop(id);
      await load();
    },
    [load]
  );

  const isRouteFavorite = useCallback(
    (id: string) => routes.some((r) => r.id === id),
    [routes]
  );

  const isStopFavorite = useCallback(
    (id: string) => stops.some((s) => s.id === id),
    [stops]
  );

  return {
    routes,
    stops,
    addRoute,
    deleteRoute,
    addStop,
    deleteStop,
    isRouteFavorite,
    isStopFavorite,
    reload: load,
  };
}

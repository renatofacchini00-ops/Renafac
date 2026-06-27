import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FavoriteRoute, FavoriteStop } from '../types';

const KEYS = {
  favoriteRoutes: '@sp_bus:favorite_routes',
  favoriteStops: '@sp_bus:favorite_stops',
  recentRoutes: '@sp_bus:recent_routes',
} as const;

async function getJSON<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function setJSON<T>(key: string, value: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getFavoriteRoutes(): Promise<FavoriteRoute[]> {
  return getJSON<FavoriteRoute>(KEYS.favoriteRoutes);
}

export async function saveFavoriteRoute(route: FavoriteRoute): Promise<void> {
  const routes = await getFavoriteRoutes();
  const filtered = routes.filter((r) => r.id !== route.id);
  await setJSON(KEYS.favoriteRoutes, [route, ...filtered]);
}

export async function removeFavoriteRoute(id: string): Promise<void> {
  const routes = await getFavoriteRoutes();
  await setJSON(KEYS.favoriteRoutes, routes.filter((r) => r.id !== id));
}

export async function getFavoriteStops(): Promise<FavoriteStop[]> {
  return getJSON<FavoriteStop>(KEYS.favoriteStops);
}

export async function saveFavoriteStop(stop: FavoriteStop): Promise<void> {
  const stops = await getFavoriteStops();
  const filtered = stops.filter((s) => s.id !== stop.id);
  await setJSON(KEYS.favoriteStops, [stop, ...filtered]);
}

export async function removeFavoriteStop(id: string): Promise<void> {
  const stops = await getFavoriteStops();
  await setJSON(KEYS.favoriteStops, stops.filter((s) => s.id !== id));
}

export async function getRecentRoutes(): Promise<FavoriteRoute[]> {
  return getJSON<FavoriteRoute>(KEYS.recentRoutes);
}

export async function addRecentRoute(route: FavoriteRoute): Promise<void> {
  const routes = await getRecentRoutes();
  const filtered = routes.filter((r) => r.id !== route.id).slice(0, 9);
  await setJSON(KEYS.recentRoutes, [route, ...filtered]);
}

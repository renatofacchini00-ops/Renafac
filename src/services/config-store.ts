import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  sptransToken: '@sp_bus:sptrans_token',
  googleMapsKey: '@sp_bus:google_maps_key',
} as const;

export interface AppConfig {
  sptransToken: string;
  googleMapsKey: string;
}

export async function getConfig(): Promise<AppConfig> {
  const [sptransToken, googleMapsKey] = await Promise.all([
    AsyncStorage.getItem(KEYS.sptransToken),
    AsyncStorage.getItem(KEYS.googleMapsKey),
  ]);
  return {
    sptransToken: sptransToken ?? process.env.EXPO_PUBLIC_SPTRANS_TOKEN ?? '',
    googleMapsKey: googleMapsKey ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  };
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const ops: Promise<void>[] = [];
  if (config.sptransToken !== undefined)
    ops.push(AsyncStorage.setItem(KEYS.sptransToken, config.sptransToken));
  if (config.googleMapsKey !== undefined)
    ops.push(AsyncStorage.setItem(KEYS.googleMapsKey, config.googleMapsKey));
  await Promise.all(ops);
}

export async function clearConfig(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.sptransToken, KEYS.googleMapsKey]);
}

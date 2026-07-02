// Obtenha sua chave SPTrans em: https://www.sptrans.com.br/desenvolvedores/
// Obtenha sua chave Google Maps em: https://console.cloud.google.com/
export const SPTRANS_TOKEN = process.env.EXPO_PUBLIC_SPTRANS_TOKEN ?? '';
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export const SPTRANS_BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';

export const SP_REGION = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export const NEARBY_RADIUS_KM = 2.5;
export const REFRESH_INTERVAL_MS = 15_000;

export const COLORS = {
  primary: '#1565C0',
  primaryLight: '#1976D2',
  primaryDark: '#0D47A1',
  accent: '#FF6F00',
  bus: '#F57C00',
  stop: '#2E7D32',
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#666680',
  border: '#E0E0E0',
  danger: '#C62828',
  success: '#2E7D32',
};

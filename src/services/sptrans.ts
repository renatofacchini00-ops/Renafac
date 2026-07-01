import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

// iOS NSURLSession gerencia cookies automaticamente quando usamos fetch com credentials: 'include'
// Não tentamos extrair/injetar cookies manualmente — deixamos o runtime fazer isso.

let authenticated = false;
let lastToken = '';

async function spFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${SPTRANS_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  });
}

async function authenticate(): Promise<boolean> {
  const { sptransToken } = await getConfig();
  if (!sptransToken) return false;
  try {
    const res = await spFetch(
      `/Login/Autenticar?token=${encodeURIComponent(sptransToken)}`,
      { method: 'POST' }
    );
    const text = await res.text();
    authenticated = text.trim() === 'true';
    lastToken = sptransToken;
    return authenticated;
  } catch {
    return false;
  }
}

async function ensureAuth(): Promise<void> {
  const { sptransToken } = await getConfig();
  if (!authenticated || lastToken !== sptransToken) {
    await authenticate();
  }
}

async function getJSON<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  await ensureAuth();
  const url = new URL(`${SPTRANS_BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await spFetch(url.pathname + url.search);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function searchLines(query: string): Promise<BusLine[]> {
  const data = await getJSON<BusLine[]>('/Linha/Buscar', { termosBusca: query });
  return Array.isArray(data) ? data : [];
}

export async function getBusPositions(): Promise<BusPosition[]> {
  const data = await getJSON<{ l: BusPosition[] }>('/Posicao');
  return Array.isArray(data?.l) ? data!.l : [];
}

export async function getBusPositionsByLine(lineCode: number): Promise<BusPosition | null> {
  return getJSON<BusPosition>('/Posicao/Linha', { codigoLinha: String(lineCode) });
}

export async function searchStops(query: string): Promise<BusStop[]> {
  const data = await getJSON<BusStop[]>('/Parada/Buscar', { termosBusca: query });
  return Array.isArray(data) ? data : [];
}

export async function getStopsByLine(lineCode: number): Promise<BusStop[]> {
  const data = await getJSON<BusStop[]>('/Parada/BuscarParadasPorLinha', {
    codigoLinha: String(lineCode),
  });
  return Array.isArray(data) ? data : [];
}

export async function getLinesByStop(stopCode: number): Promise<BusLine[]> {
  const data = await getJSON<BusLine[]>('/Linha/BuscarPorParada', {
    codigoParada: String(stopCode),
  });
  return Array.isArray(data) ? data : [];
}

export async function getArrivalForecast(
  stopCode: number,
  lineCode: number
): Promise<{ hr: string; vs: Array<{ p: string; t: string; a: boolean }> } | null> {
  const data = await getJSON<any>('/Previsao', {
    codigoParada: String(stopCode),
    codigoLinha: String(lineCode),
  });
  return data?.p?.l?.[0] ?? null;
}

export async function testConnection(): Promise<boolean> {
  authenticated = false;
  lastToken = '';
  return authenticate();
}

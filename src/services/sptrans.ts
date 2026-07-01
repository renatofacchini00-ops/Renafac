import axios from 'axios';
import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

const api = axios.create({
  baseURL: SPTRANS_BASE_URL,
  withCredentials: true,
  timeout: 10_000,
});

let authenticated = false;
let lastToken = '';

async function authenticate(): Promise<boolean> {
  const { sptransToken } = await getConfig();
  if (!sptransToken) return false;
  try {
    const res = await api.post(`/Login/Autenticar?token=${sptransToken}`);
    authenticated = res.data === true;
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

export async function searchLines(query: string): Promise<BusLine[]> {
  await ensureAuth();
  const res = await api.get('/Linha/Buscar', { params: { termosBusca: query } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getBusPositions(): Promise<BusPosition[]> {
  await ensureAuth();
  const res = await api.get('/Posicao');
  return Array.isArray(res.data?.l) ? res.data.l : [];
}

export async function getBusPositionsByLine(lineCode: number): Promise<BusPosition | null> {
  await ensureAuth();
  const res = await api.get('/Posicao/Linha', { params: { codigoLinha: lineCode } });
  return res.data ?? null;
}

export async function searchStops(query: string): Promise<BusStop[]> {
  await ensureAuth();
  const res = await api.get('/Parada/Buscar', { params: { termosBusca: query } });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getStopsByLine(lineCode: number): Promise<BusStop[]> {
  await ensureAuth();
  const res = await api.get('/Parada/BuscarParadasPorLinha', {
    params: { codigoLinha: lineCode },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getLinesByStop(stopCode: number): Promise<BusLine[]> {
  await ensureAuth();
  const res = await api.get('/Linha/BuscarPorParada', {
    params: { codigoParada: stopCode },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getArrivalForecast(
  stopCode: number,
  lineCode: number
): Promise<{ hr: string; vs: Array<{ p: string; t: string; a: boolean }> } | null> {
  await ensureAuth();
  const res = await api.get('/Previsao', {
    params: { codigoParada: stopCode, codigoLinha: lineCode },
  });
  return res.data?.p?.l?.[0] ?? null;
}

export async function testConnection(): Promise<boolean> {
  authenticated = false;
  return authenticate();
}

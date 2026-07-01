import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

// Gerenciamos o cookie manualmente para evitar que o NSURLSession envie cookies
// de sessões antigas expiradas junto com o POST de autenticação, o que faz o
// servidor ignorar o token e retornar "false".
let sessionCookie = '';
let authenticated = false;
let lastToken = '';

async function spFetch(path: string, options?: RequestInit): Promise<Response> {
  const cookieHeader: Record<string, string> = sessionCookie
    ? { Cookie: sessionCookie }
    : {};
  return fetch(`${SPTRANS_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...cookieHeader,
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  });
}

async function authenticate(): Promise<{ ok: boolean; detail: string }> {
  const { sptransToken } = await getConfig();
  if (!sptransToken) return { ok: false, detail: 'Token não configurado' };
  try {
    // Sem credentials:'include' para não enviar cookies velhos do NSURLSession
    const res = await fetch(
      `${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(sptransToken)}`,
      {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    const text = await res.text();
    const ok = text.trim() === 'true';
    if (ok) {
      const raw = res.headers.get('set-cookie') ?? res.headers.get('Set-Cookie') ?? '';
      sessionCookie = raw.split(';')[0]; // guarda só "apiCredentials=xxxx"
    }
    authenticated = ok;
    lastToken = sptransToken;
    return { ok, detail: `HTTP ${res.status} → "${text.trim().slice(0, 80)}"` };
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? String(e) };
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

export async function testConnection(): Promise<{ ok: boolean; detail: string }> {
  authenticated = false;
  lastToken = '';
  return authenticate();
}

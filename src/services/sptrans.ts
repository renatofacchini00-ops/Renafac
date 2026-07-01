import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

// O cookie de sessão (apiCredentials) é gerenciado automaticamente pelo
// NSURLSession/OkHttp do React Native: ele é armazenado quando o servidor
// responde ao /Login/Autenticar e reenviado sozinho nas chamadas seguintes.
// NÃO tentamos ler o header Set-Cookie manualmente — no iOS o fetch bloqueia
// a leitura desse header (é um "forbidden response header"), então a captura
// manual sempre volta vazia e as chamadas de dados eram negadas.
let authenticated = false;
let lastToken = '';

async function spFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${SPTRANS_BASE_URL}${path}`, {
    credentials: 'include', // reenvia o cookie de sessão guardado pelo SO
    ...options,
  });
}

async function authenticate(): Promise<{ ok: boolean; detail: string }> {
  const { sptransToken } = await getConfig();
  const token = sptransToken.trim(); // remove espaços/newlines que chegam via copy-paste
  if (!token) return { ok: false, detail: 'Token não configurado' };

  const tokenPreview = `${token.slice(0, 8)}…${token.slice(-4)} (${token.length} chars)`;

  try {
    const res = await spFetch(
      `/Login/Autenticar?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: '', // força Content-Length: 0 (a API rejeita POST sem corpo com HTTP 411)
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    const text = await res.text();
    const body = text.trim();
    const ok = body.toLowerCase() === 'true';
    authenticated = ok;
    lastToken = token;
    return {
      ok,
      detail: `token: ${tokenPreview}\nHTTP ${res.status} → "${body.slice(0, 80)}"`,
    };
  } catch (e: any) {
    return {
      ok: false,
      detail: `token: ${tokenPreview}\nErro: ${e?.message ?? String(e)}`,
    };
  }
}

async function ensureAuth(): Promise<void> {
  const { sptransToken } = await getConfig();
  if (!authenticated || lastToken !== sptransToken.trim()) {
    await authenticate();
  }
}


async function getJSON<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  await ensureAuth();
  const url = new URL(`${SPTRANS_BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    let res = await spFetch(url.pathname + url.search);
    // Sessão pode ter expirado (cookie vencido) → reautentica uma vez e repete.
    if (res.status === 401 || res.status === 403) {
      authenticated = false;
      await ensureAuth();
      res = await spFetch(url.pathname + url.search);
    }
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

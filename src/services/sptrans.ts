import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

// O cookie de sessão (apiCredentials) é exigido em toda chamada de dados.
// Estratégia dupla (belt-and-suspenders):
//  1) credentials:'include' → deixa o NSURLSession/OkHttp reenviar o cookie
//     automaticamente (funciona quando o SO persiste o cookie).
//  2) Se conseguirmos ler o header Set-Cookie na resposta do login, guardamos
//     o valor e o reenviamos manualmente via header Cookie. No React Native o
//     fetch às vezes PERMITE ler Set-Cookie (diferente do browser), então esse
//     fallback cobre o caso em que a persistência automática falha.
let authenticated = false;
let lastToken = '';
let sessionCookie = ''; // ex.: "apiCredentials=ABC123"

function readSetCookie(res: Response): string {
  const raw =
    res.headers.get('set-cookie') ?? res.headers.get('Set-Cookie') ?? '';
  if (!raw) return '';
  // pega só o par nome=valor do apiCredentials, ignorando path/HttpOnly/etc
  const match = raw.match(/apiCredentials=[^;,\s]+/);
  return match ? match[0] : raw.split(';')[0];
}

async function spFetch(path: string, options?: RequestInit): Promise<Response> {
  const extraHeaders: Record<string, string> = sessionCookie
    ? { Cookie: sessionCookie }
    : {};
  return fetch(`${SPTRANS_BASE_URL}${path}`, {
    credentials: 'include', // reenvia o cookie de sessão guardado pelo SO
    ...options,
    headers: {
      ...extraHeaders,
      ...((options?.headers as Record<string, string>) ?? {}),
    },
  });
}

async function authenticate(): Promise<{ ok: boolean; detail: string }> {
  const { sptransToken } = await getConfig();
  const token = sptransToken.trim(); // remove espaços/newlines que chegam via copy-paste
  if (!token) return { ok: false, detail: 'Token não configurado' };

  const tokenPreview = `${token.slice(0, 8)}…${token.slice(-4)} (${token.length} chars)`;

  try {
    const res = await fetch(
      `${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: '', // força Content-Length: 0 (a API rejeita POST sem corpo com HTTP 411)
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
      }
    );
    const text = await res.text();
    const body = text.trim();
    const ok = body.toLowerCase() === 'true';
    if (ok) {
      const captured = readSetCookie(res);
      if (captured) sessionCookie = captured;
    }
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
  sessionCookie = '';
  return authenticate();
}

// Descreve o resultado de um GET /Posicao em uma linha curta.
function describePosicao(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.l)) {
      const total = parsed.l.reduce(
        (acc: number, l: any) => acc + (l.vs?.length ?? 0),
        0
      );
      return `HTTP ${status} → ${total} ônibus ✅`;
    }
    if (parsed?.Message) return `HTTP ${status} → negado ✗`;
  } catch {
    // cai no genérico abaixo
  }
  return `HTTP ${status} → ${raw.slice(0, 40)}`;
}

// Autentica e então testa 3 formas de mandar o cookie no GET /Posicao,
// pra descobrir qual estratégia o iOS aceita. A que devolver ônibus é a certa.
export async function runDiagnostics(): Promise<string> {
  const lines: string[] = [];
  const { sptransToken } = await getConfig();
  const token = sptransToken.trim();
  lines.push(`Token: ${token ? `${token.slice(0, 6)}… (${token.length} chars)` : 'VAZIO'}`);
  if (!token) return lines.join('\n');

  // Autentica (fresco), pedindo pro SO guardar o cookie via credentials
  let cookie = '';
  try {
    const authRes = await fetch(
      `${SPTRANS_BASE_URL}/Login/Autenticar?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
      }
    );
    const authBody = (await authRes.text()).trim();
    lines.push(`Auth: HTTP ${authRes.status} "${authBody.slice(0, 12)}"`);
    const rawCookie =
      authRes.headers.get('set-cookie') ?? authRes.headers.get('Set-Cookie') ?? '';
    const m = rawCookie.match(/apiCredentials=[^;,\s]+/);
    cookie = m ? m[0] : '';
    lines.push(`Cookie: valor ${cookie.length} chars (header cru ${rawCookie.length})`);
    // sincroniza estado global com a estratégia que vamos escolher
    sessionCookie = cookie;
    authenticated = authBody.toLowerCase() === 'true';
    lastToken = token;
  } catch (e: any) {
    lines.push(`Auth ERRO: ${e?.message ?? String(e)}`);
    return lines.join('\n');
  }

  const url = `${SPTRANS_BASE_URL}/Posicao`;

  // A) só cookie manual, sem credentials
  try {
    const r = await fetch(url, cookie ? { headers: { Cookie: cookie } } : {});
    lines.push(`A) cookie manual: ${describePosicao(r.status, await r.text())}`);
  } catch (e: any) {
    lines.push(`A) erro: ${e?.message ?? String(e)}`);
  }

  // B) só cookie do SO (credentials), sem header manual
  try {
    const r = await fetch(url, { credentials: 'include' });
    lines.push(`B) cookie do SO: ${describePosicao(r.status, await r.text())}`);
  } catch (e: any) {
    lines.push(`B) erro: ${e?.message ?? String(e)}`);
  }

  // C) os dois juntos
  try {
    const r = await fetch(url, {
      credentials: 'include',
      ...(cookie ? { headers: { Cookie: cookie } } : {}),
    });
    lines.push(`C) ambos: ${describePosicao(r.status, await r.text())}`);
  } catch (e: any) {
    lines.push(`C) erro: ${e?.message ?? String(e)}`);
  }

  lines.push('\nA que mostrar "ônibus ✅" é a estratégia certa.');
  return lines.join('\n');
}

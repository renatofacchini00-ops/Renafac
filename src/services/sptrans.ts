import { SPTRANS_BASE_URL } from '../constants/config';
import { getConfig } from './config-store';
import type { BusLine, BusPosition, BusStop } from '../types';

// Estratégia confirmada em campo (ver runDiagnostics): o cookie de sessão
// (apiCredentials) precisa ser gerenciado EXCLUSIVAMENTE pelo NSURLSession/
// OkHttp via credentials:'include'. Reenviar o cookie manualmente num header
// Cookie faz o iOS responder 401 — por isso NUNCA setamos o header Cookie.
let authenticated = false;
let lastToken = '';

async function spFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${SPTRANS_BASE_URL}${path}`, {
    credentials: 'include', // o SO reenvia o cookie de sessão automaticamente
    ...options,
  });
}

async function authenticate(): Promise<{ ok: boolean; detail: string }> {
  const { sptransToken } = await getConfig();
  const token = sptransToken.trim(); // remove espaços/newlines que chegam via copy-paste
  if (!token) return { ok: false, detail: 'Token não configurado' };

  const tokenPreview = `${token.slice(0, 8)}…${token.slice(-4)} (${token.length} chars)`;

  try {
    // credentials:'include' faz o SO GUARDAR o cookie devolvido pelo login
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
  // IMPORTANTE: montamos a query manualmente. Usar new URL(BASE+path) e pegar
  // url.pathname devolveria "/v2.1/Posicao", que o spFetch prependaria de novo
  // com o BASE (que já tem /v2.1), gerando ".../v2.1/v2.1/Posicao" (inválido).
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const relPath = `${path}${qs}`;
  try {
    let res = await spFetch(relPath);
    // Sessão pode ter expirado (cookie vencido) → reautentica uma vez e repete.
    if (res.status === 401 || res.status === 403) {
      authenticated = false;
      await ensureAuth();
      res = await spFetch(relPath);
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

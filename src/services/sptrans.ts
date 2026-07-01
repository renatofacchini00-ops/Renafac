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

// Roda o fluxo completo passo a passo e devolve um relatório legível na tela,
// pra descobrirmos exatamente onde os ônibus deixam de vir.
export async function runDiagnostics(): Promise<string> {
  const lines: string[] = [];
  authenticated = false;
  lastToken = '';
  sessionCookie = '';

  const { sptransToken } = await getConfig();
  const token = sptransToken.trim();
  lines.push(`1) Token: ${token ? `${token.slice(0, 6)}… (${token.length} chars)` : 'VAZIO'}`);

  // Passo 2: autenticar
  const auth = await authenticate();
  lines.push(`2) Autenticação: ${auth.ok ? 'OK ✓' : 'FALHOU ✗'}`);
  lines.push(`   ${auth.detail.replace(/\n/g, '\n   ')}`);
  lines.push(`3) Cookie capturado do header: ${sessionCookie ? sessionCookie.slice(0, 24) + '…' : 'NÃO (header não legível)'}`);

  if (!auth.ok) {
    lines.push('\n⛔ Parou na autenticação. Verifique o token.');
    return lines.join('\n');
  }

  // Passo 4: buscar posições cru
  try {
    const res = await spFetch('/Posicao');
    lines.push(`4) GET /Posicao: HTTP ${res.status}`);
    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lines.push(`   Resposta não-JSON: ${raw.slice(0, 120)}`);
    }
    if (parsed) {
      if (Array.isArray(parsed?.l)) {
        const total = parsed.l.reduce(
          (acc: number, l: any) => acc + (l.vs?.length ?? 0),
          0
        );
        lines.push(`5) Ônibus recebidos: ${total} (em ${parsed.l.length} linhas)`);
        lines.push(total > 0 ? '\n✅ A API está devolvendo ônibus!' : '\n⚠️ Zero ônibus (incomum).');
      } else if (parsed?.Message) {
        lines.push(`5) Negado pela API: "${parsed.Message}"`);
        lines.push('\n⛔ O cookie de sessão não foi aceito.');
      } else {
        lines.push(`5) Formato inesperado: ${raw.slice(0, 120)}`);
      }
    }
  } catch (e: any) {
    lines.push(`4) Erro no /Posicao: ${e?.message ?? String(e)}`);
  }

  return lines.join('\n');
}

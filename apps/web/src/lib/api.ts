// Cliente da API com refresh automático de token (docs/09).
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function getTokens() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('finanfy.tokens');
  return raw ? (JSON.parse(raw) as { accessToken: string; refreshToken: string }) : null;
}

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  if (tokens) localStorage.setItem('finanfy.tokens', JSON.stringify(tokens));
  else localStorage.removeItem('finanfy.tokens');
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, options: RequestInit = {}, token?: string) {
  const res = await fetch(`${API}/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return res;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokens = getTokens();
  let res = await rawFetch(path, options, tokens?.accessToken);

  // access expirou? tenta refresh uma vez
  if (res.status === 401 && tokens?.refreshToken) {
    const refresh = await rawFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (refresh.ok) {
      const newTokens = (await refresh.json()) as { accessToken: string; refreshToken: string };
      setTokens(newTokens);
      res = await rawFetch(path, options, newTokens.accessToken);
    } else {
      setTokens(null);
      window.location.href = '/login';
      throw new ApiError('UNAUTHORIZED', 'Sessão expirada');
    }
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(err?.code ?? 'ERROR', err?.message ?? 'Algo deu errado.');
  }
  return body as T;
}

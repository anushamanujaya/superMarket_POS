const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const KEY = 'pos.tokens';
export const tokenStore = {
  get(): Tokens | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    try {
      if (t) localStorage.setItem(KEY, JSON.stringify(t));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: t.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) {
        tokenStore.set(null);
        return false;
      }
      tokenStore.set(await r.json());
      return true;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const t = tokenStore.get();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(t && { authorization: `Bearer ${t.accessToken}` }),
      ...init.headers,
    },
  });
  if (res.status === 401 && retry && path !== '/auth/login' && (await refresh())) {
    return api<T>(path, init, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function login(body: Record<string, string>, pin: boolean) {
  const tokens = await api<Tokens>(pin ? '/auth/pin-login' : '/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  tokenStore.set(tokens);
}

export async function logout() {
  const t = tokenStore.get();
  if (t)
    await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: t.refreshToken }),
    }).catch(() => {});
  tokenStore.set(null);
}

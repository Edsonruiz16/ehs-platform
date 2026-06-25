const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ehs_token');
}

export function setToken(token: string) {
  localStorage.setItem('ehs_token', token);
}

export function clearToken() {
  localStorage.removeItem('ehs_token');
  localStorage.removeItem('ehs_user');
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  isForm?: boolean;
}

export async function api<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.isForm) {
      body = opts.body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(url.toString(), { method: opts.method ?? 'GET', headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Error ${res.status}`);
  }
  return json as T;
}

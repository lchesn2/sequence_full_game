// All API calls go through this module.
// The JWT is stored in sessionStorage (cleared when the browser tab closes).

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787';

function getToken(): string | null {
  return sessionStorage.getItem('seq_token');
}

export function saveToken(token: string): void {
  sessionStorage.setItem('seq_token', token);
}

export function clearToken(): void {
  sessionStorage.removeItem('seq_token');
  sessionStorage.removeItem('seq_username');
}

export function saveUsername(username: string): void {
  sessionStorage.setItem('seq_username', username);
}

export function getSavedUsername(): string | null {
  return sessionStorage.getItem('seq_username');
}

export function getSavedToken(): string | null {
  return sessionStorage.getItem('seq_token');
}

// ─── Internal fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (requireAuth) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json() as { error?: string } & T;

  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return json;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiRegister(username: string, password: string) {
  return apiFetch<{ token: string; username: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function apiLogin(username: string, password: string) {
  return apiFetch<{ token: string; username: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export async function apiStartGame() {
  return apiFetch<{ gameState: unknown }>('/api/game/start', { method: 'POST' }, true);
}

export async function apiMove(gameState: unknown, move: unknown) {
  return apiFetch<{ gameState: unknown }>('/api/game/move', {
    method: 'POST',
    body: JSON.stringify({ gameState, move }),
  }, true);
}

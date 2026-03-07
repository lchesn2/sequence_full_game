import { Context } from 'hono';
import { SignJWT, jwtVerify } from 'jose';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

// ─── Password hashing via Web Crypto (PBKDF2) ─────────────────────────────────
// Native in Workers — no npm package needed.

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  );

  const toHex = (buf: ArrayBuffer) =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = toHex(salt.buffer);
  const hashHex = toHex(hashBits);

  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)));
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const computed = Array.from(new Uint8Array(hashBits))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === hashHex;
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export async function signToken(
  payload: { userId: number; username: string },
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ userId: number; username: string }> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as { userId: number; username: string };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function handleRegister(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req.json<{ username?: string; password?: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }
  if (username.length < 3 || username.length > 20) {
    return c.json({ error: 'Username must be 3–20 characters' }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ error: 'Username may only contain letters, numbers, and underscores' }, 400);
  }

  // Check existing user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();

  if (existing) return c.json({ error: 'Username already taken' }, 409);

  const hash = await hashPassword(password);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).bind(username, hash).run();

  const token = await signToken(
    { userId: result.meta.last_row_id as number, username },
    c.env.JWT_SECRET,
  );

  return c.json({ token, username });
}

export async function handleLogin(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req.json<{ username?: string; password?: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ?'
  ).bind(username).first<{ id: number; password_hash: string }>();

  if (!user) return c.json({ error: 'Invalid username or password' }, 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return c.json({ error: 'Invalid username or password' }, 401);

  const token = await signToken({ userId: user.id, username }, c.env.JWT_SECRET);
  return c.json({ token, username });
}

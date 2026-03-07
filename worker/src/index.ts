import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import { handleRegister, handleLogin, verifyToken } from './auth';
import { handleStart, handleMove } from './game';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow local dev (localhost:5173) and any Cloudflare Pages domain.
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') ?? '';
  const allowed =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.endsWith('.pages.dev') ||
    origin === c.env.FRONTEND_URL;

  const corsMiddleware = cors({
    origin: allowed ? origin : c.env.FRONTEND_URL,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  return corsMiddleware(c, next);
});

// ─── Public auth routes ───────────────────────────────────────────────────────

app.post('/api/auth/register', handleRegister);
app.post('/api/auth/login', handleLogin);

// ─── JWT middleware for /api/game/* ───────────────────────────────────────────

app.use('/api/game/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorised' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set('jwtPayload' as never, payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

// ─── Game routes ──────────────────────────────────────────────────────────────

app.post('/api/game/start', handleStart);
app.post('/api/game/move', handleMove);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;

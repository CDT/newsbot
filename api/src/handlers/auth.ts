import type { Env } from '../types';
import { jsonResponse } from '../utils/response';
import { signJwt, verifyJwt } from '../utils/jwt';
import { getCookieValue } from '../utils/parsing';
import { getSessionTtlSeconds } from '../config';

const SESSION_COOKIE = 'session';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  if (!body?.username || !body?.password) {
    return jsonResponse({ error: 'Missing credentials' }, 400);
  }

  if (body.username !== env.ADMIN_USERNAME || body.password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }

  const ttl = getSessionTtlSeconds(env);
  const token = await signJwt({ sub: body.username }, env.JWT_SECRET, ttl);
  const headers = new Headers({ 'content-type': 'application/json;charset=UTF-8' });
  headers.append(
    'set-cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=${ttl}`
  );

  return new Response(JSON.stringify({ ok: true, token }), { status: 200, headers });
}

export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenFromHeader || getCookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return null;
}

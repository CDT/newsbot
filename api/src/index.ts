import type { Env } from './types';
import { handleLogin, requireAuth } from './handlers/auth';
import { handleGetGlobalSettings, handleUpdateGlobalSettings } from './handlers/global-settings';
import {
  handleListConfigSets,
  handleCreateConfigSet,
  handleUpdateConfigSet,
  handleDeleteConfigSet,
} from './handlers/config-sets';
import {
  handleRunConfigSet,
  handleListRuns,
  handleDeleteRun,
  handleDeleteRuns,
  handleDeleteAllRuns,
  getEnabledConfigSets,
  runConfigSet,
} from './handlers/runs';
import {
  handleListSources,
  handleGetSource,
  handleCreateSource,
  handleUpdateSource,
  handleDeleteSource,
  handleTestSource,
} from './handlers/sources';
import { jsonResponse } from './utils/response';

export type { Env } from './types';

async function handleRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  if (url.pathname.startsWith('/api')) {
    const authError = await requireAuth(request, env);
    if (authError) {
      return authError;
    }
  }

  if (url.pathname === '/api/global-settings') {
    if (request.method === 'GET') {
      return handleGetGlobalSettings(env);
    }
    if (request.method === 'PUT') {
      return handleUpdateGlobalSettings(request, env);
    }
  }

  if (url.pathname === '/api/config-sets') {
    if (request.method === 'GET') {
      return handleListConfigSets(env);
    }
    if (request.method === 'POST') {
      return handleCreateConfigSet(request, env);
    }
  }

  if (url.pathname.startsWith('/api/config-sets/') && request.method === 'PUT') {
    const id = Number(url.pathname.split('/').pop());
    return handleUpdateConfigSet(request, env, id);
  }

  if (url.pathname.startsWith('/api/config-sets/') && request.method === 'DELETE') {
    const id = Number(url.pathname.split('/').pop());
    return handleDeleteConfigSet(env, id);
  }

  if (url.pathname.startsWith('/api/run/') && request.method === 'POST') {
    const id = Number(url.pathname.split('/').pop());
    return handleRunConfigSet(env, id);
  }

  if (url.pathname === '/api/runs' && request.method === 'GET') {
    return handleListRuns(env);
  }

  if (url.pathname === '/api/runs/all' && request.method === 'DELETE') {
    return handleDeleteAllRuns(env);
  }

  if (url.pathname === '/api/runs' && request.method === 'DELETE') {
    return handleDeleteRuns(request, env);
  }

  const runsMatch = url.pathname.match(/^\/api\/runs\/(\d+)$/);
  if (runsMatch && request.method === 'DELETE') {
    const id = Number(runsMatch[1]);
    return handleDeleteRun(env, id);
  }

  // Sources endpoints
  if (url.pathname === '/api/sources') {
    if (request.method === 'GET') {
      return handleListSources(env);
    }
    if (request.method === 'POST') {
      return handleCreateSource(request, env);
    }
  }

  if (url.pathname === '/api/sources/test' && request.method === 'POST') {
    // Test source without saving (from request body)
    return handleTestSource(request, env);
  }

  const sourcesMatch = url.pathname.match(/^\/api\/sources\/(\d+)$/);
  if (sourcesMatch) {
    const id = Number(sourcesMatch[1]);
    if (request.method === 'GET') {
      return handleGetSource(env, id);
    }
    if (request.method === 'PUT') {
      return handleUpdateSource(request, env, id);
    }
    if (request.method === 'DELETE') {
      return handleDeleteSource(env, id);
    }
  }

  const sourceTestMatch = url.pathname.match(/^\/api\/sources\/(\d+)\/test$/);
  if (sourceTestMatch && request.method === 'POST') {
    const id = Number(sourceTestMatch[1]);
    return handleTestSource(request, env, id);
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('Unhandled API error:', message);
      return jsonResponse({ error: message }, 500);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const configs = await getEnabledConfigSets(env, event.cron);
    for (const config of configs) {
      ctx.waitUntil(runConfigSet(env, config));
    }
  },
};

import type { Env } from './types';
import { handleLogin, requireAuth } from './handlers/auth';
import { handleGetGlobalSettings, handleUpdateGlobalSettings } from './handlers/global-settings';
import {
  handleListConfigSets,
  handleCreateConfigSet,
  handleUpdateConfigSet,
  handleDeleteConfigSet,
} from './handlers/config-sets';
import { handleRunConfigSet, handleListRuns, getEnabledConfigSets, runConfigSet } from './handlers/runs';

export type { Env } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const configs = await getEnabledConfigSets(env, event.cron);
    for (const config of configs) {
      ctx.waitUntil(runConfigSet(env, config));
    }
  },
};

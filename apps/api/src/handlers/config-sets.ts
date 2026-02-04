import type { Env, ConfigSet } from '../types';
import { jsonResponse } from '../utils/response';

export async function handleListConfigSets(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set ORDER BY id DESC'
  ).all<ConfigSet>();
  return jsonResponse(rows.results ?? []);
}

export async function handleCreateConfigSet(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<ConfigSet> | null;
  if (!body?.name || !body?.schedule_cron || !body?.prompt) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  const sources = body.sources_json ?? '[]';
  const recipients = body.recipients_json ?? '[]';

  const result = await env.DB.prepare(
    'INSERT INTO config_set (name, enabled, schedule_cron, prompt, sources_json, recipients_json) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(body.name, body.enabled ? 1 : 0, body.schedule_cron, body.prompt, sources, recipients)
    .run();

  return jsonResponse({ ok: true, id: result.meta.last_row_id });
}

export async function handleUpdateConfigSet(
  request: Request,
  env: Env,
  id: number
): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  const body = (await request.json().catch(() => null)) as Partial<ConfigSet> | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  await env.DB.prepare(
    'UPDATE config_set SET name = ?, enabled = ?, schedule_cron = ?, prompt = ?, sources_json = ?, recipients_json = ? WHERE id = ?'
  )
    .bind(
      body.name ?? '',
      body.enabled ? 1 : 0,
      body.schedule_cron ?? '',
      body.prompt ?? '',
      body.sources_json ?? '[]',
      body.recipients_json ?? '[]',
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

export async function handleDeleteConfigSet(env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  await env.DB.prepare('DELETE FROM config_set WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}

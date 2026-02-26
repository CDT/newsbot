import type { Env, ConfigSet } from '../types';
import { ALLOWED_SCHEDULES, isAllowedScheduleCron } from '../config';
import { jsonResponse } from '../utils/response';

type ConfigSetResponse = ConfigSet & { source_ids: number[] };

function normalizeCron(cron: string): string {
  const parts = cron.split(',').map((part) => part.trim().replace(/\s+/g, ' '));
  return [...new Set(parts)].join(',');
}

function getInvalidScheduleMessage(): string {
  const allowed = ALLOWED_SCHEDULES.map((option) => option.cron).join(', ');
  return `Invalid schedule_cron. Allowed values (comma-separated): ${allowed}`;
}

async function getSourceIds(db: D1Database, configSetId: number): Promise<number[]> {
  const rows = await db
    .prepare('SELECT source_id FROM config_set_source WHERE config_set_id = ?')
    .bind(configSetId)
    .all<{ source_id: number }>();
  return (rows.results ?? []).map((r) => r.source_id);
}

async function syncSourceIds(db: D1Database, configSetId: number, sourceIds: number[]): Promise<void> {
  await db.prepare('DELETE FROM config_set_source WHERE config_set_id = ?').bind(configSetId).run();
  for (const sourceId of sourceIds) {
    await db
      .prepare('INSERT INTO config_set_source (config_set_id, source_id) VALUES (?, ?)')
      .bind(configSetId, sourceId)
      .run();
  }
}

export async function handleListConfigSets(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, recipients_json, use_web_search FROM config_set ORDER BY id DESC'
  ).all<ConfigSet>();

  const configs: ConfigSetResponse[] = [];
  for (const row of rows.results ?? []) {
    const source_ids = await getSourceIds(env.DB, row.id);
    configs.push({ ...row, source_ids });
  }

  return jsonResponse(configs);
}

export async function handleCreateConfigSet(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | (Partial<ConfigSet> & { source_ids?: number[] })
    | null;
  if (!body?.name || !body?.schedule_cron || !body?.prompt) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  const scheduleCron = normalizeCron(body.schedule_cron);
  if (!isAllowedScheduleCron(scheduleCron)) {
    return jsonResponse({ error: getInvalidScheduleMessage() }, 400);
  }
  const recipients = body.recipients_json ?? '[]';
  const sourceIds = body.source_ids ?? [];

  const result = await env.DB.prepare(
    'INSERT INTO config_set (name, enabled, schedule_cron, prompt, recipients_json, use_web_search) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(body.name, body.enabled ? 1 : 0, scheduleCron, body.prompt, recipients, body.use_web_search ? 1 : 0)
    .run();

  const newId = result.meta.last_row_id as number;
  await syncSourceIds(env.DB, newId, sourceIds);

  return jsonResponse({ ok: true, id: newId });
}

export async function handleUpdateConfigSet(
  request: Request,
  env: Env,
  id: number
): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  const body = (await request.json().catch(() => null)) as
    | (Partial<ConfigSet> & { source_ids?: number[] })
    | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }
  if (!body.name || !body.schedule_cron || !body.prompt) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }

  const scheduleCron = normalizeCron(body.schedule_cron);
  if (!isAllowedScheduleCron(scheduleCron)) {
    return jsonResponse({ error: getInvalidScheduleMessage() }, 400);
  }

  await env.DB.prepare(
    'UPDATE config_set SET name = ?, enabled = ?, schedule_cron = ?, prompt = ?, recipients_json = ?, use_web_search = ? WHERE id = ?'
  )
    .bind(
      body.name,
      body.enabled ? 1 : 0,
      scheduleCron,
      body.prompt,
      body.recipients_json ?? '[]',
      body.use_web_search ? 1 : 0,
      id
    )
    .run();

  if (body.source_ids) {
    await syncSourceIds(env.DB, id, body.source_ids);
  }

  return jsonResponse({ ok: true });
}

export async function handleDeleteConfigSet(env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  await env.DB.prepare('DELETE FROM run_log WHERE config_set_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM config_set_source WHERE config_set_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM config_set WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}

import type { Env, ConfigSet } from '../types';
import { ALLOWED_SCHEDULES, isAllowedScheduleCron } from '../config';
import { jsonResponse } from '../utils/response';

type ConfigSetResponse = ConfigSet & { source_ids: number[] };

let configSetSchemaPromise: Promise<void> | null = null;

function isDuplicateColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('duplicate column') || message.includes('duplicate column name');
}

async function ensureConfigSetSchema(env: Env): Promise<void> {
  if (configSetSchemaPromise) {
    await configSetSchemaPromise;
    return;
  }

  configSetSchemaPromise = (async () => {
    const tableInfo = await env.DB.prepare('PRAGMA table_info(config_set)').all<{ name: string }>();
    const existingColumns = new Set((tableInfo.results ?? []).map((column) => column.name));

    if (!existingColumns.has('web_search_query')) {
      try {
        await env.DB.prepare('ALTER TABLE config_set ADD COLUMN web_search_query TEXT').run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) throw error;
      }
    }

    if (!existingColumns.has('web_search_provider')) {
      try {
        await env.DB.prepare("ALTER TABLE config_set ADD COLUMN web_search_provider TEXT NOT NULL DEFAULT 'tavily'").run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) throw error;
      }
    }

    if (!existingColumns.has('serp_engine')) {
      try {
        await env.DB.prepare('ALTER TABLE config_set ADD COLUMN serp_engine TEXT').run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) throw error;
      }
    }

    if (!existingColumns.has('web_search_max_results')) {
      try {
        await env.DB.prepare('ALTER TABLE config_set ADD COLUMN web_search_max_results INTEGER NOT NULL DEFAULT 10').run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) throw error;
      }
    }
  })();

  try {
    await configSetSchemaPromise;
  } finally {
    configSetSchemaPromise = null;
  }
}

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
  await ensureConfigSetSchema(env);
  const rows = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, recipients_json, use_web_search, web_search_query, web_search_provider, serp_engine, web_search_max_results FROM config_set ORDER BY id DESC'
  ).all<ConfigSet>();

  const configs: ConfigSetResponse[] = [];
  for (const row of rows.results ?? []) {
    const source_ids = await getSourceIds(env.DB, row.id);
    configs.push({ ...row, source_ids });
  }

  return jsonResponse(configs);
}

export async function handleCreateConfigSet(request: Request, env: Env): Promise<Response> {
  await ensureConfigSetSchema(env);
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
    'INSERT INTO config_set (name, enabled, schedule_cron, prompt, recipients_json, use_web_search, web_search_query, web_search_provider, serp_engine, web_search_max_results) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(body.name, body.enabled ? 1 : 0, scheduleCron, body.prompt, recipients, body.use_web_search ? 1 : 0, body.web_search_query ?? null, body.web_search_provider ?? 'tavily', body.serp_engine ?? null, body.web_search_max_results ?? 10)
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
  await ensureConfigSetSchema(env);
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
    'UPDATE config_set SET name = ?, enabled = ?, schedule_cron = ?, prompt = ?, recipients_json = ?, use_web_search = ?, web_search_query = ?, web_search_provider = ?, serp_engine = ?, web_search_max_results = ? WHERE id = ?'
  )
    .bind(
      body.name,
      body.enabled ? 1 : 0,
      scheduleCron,
      body.prompt,
      body.recipients_json ?? '[]',
      body.use_web_search ? 1 : 0,
      body.web_search_query ?? null,
      body.web_search_provider ?? 'tavily',
      body.serp_engine ?? null,
      body.web_search_max_results ?? 10,
      id
    )
    .run();

  if (body.source_ids) {
    await syncSourceIds(env.DB, id, body.source_ids);
  }

  return jsonResponse({ ok: true });
}

export async function handlePatchConfigSet(request: Request, env: Env, id: number): Promise<Response> {
  await ensureConfigSetSchema(env);
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  const body = (await request.json().catch(() => null)) as Partial<ConfigSet> | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.web_search_query !== undefined) {
    const query = body.web_search_query?.trim() || null;
    fields.push('web_search_query = ?');
    fields.push('use_web_search = ?');
    values.push(query, query ? 1 : 0);
  }
  if (body.web_search_provider !== undefined) {
    fields.push('web_search_provider = ?');
    values.push(body.web_search_provider);
  }
  if (body.serp_engine !== undefined) {
    fields.push('serp_engine = ?');
    values.push(body.serp_engine);
  }
  if (body.web_search_max_results !== undefined) {
    fields.push('web_search_max_results = ?');
    values.push(body.web_search_max_results);
  }

  if (fields.length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400);
  }

  values.push(id);
  await env.DB.prepare(`UPDATE config_set SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

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

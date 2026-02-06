import type { Env, ConfigSet, GlobalSettings, NewsItem, Source } from '../types';
import { jsonResponse } from '../utils/response';
import { safeParseJsonArray } from '../utils/parsing';
import { fetchRssItems, fetchApiItems, dedupeItems } from '../services/sources';
import { summarizeWithGemini } from '../services/gemini';
import { buildEmailHtml, sendResendEmail } from '../services/email';

export async function handleRunConfigSet(env: Env, id: number): Promise<Response> {
  const config = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set WHERE id = ?'
  )
    .bind(id)
    .first<ConfigSet>();

  if (!config) {
    return jsonResponse({ error: 'Config set not found' }, 404);
  }

  await runConfigSet(env, config);
  return jsonResponse({ ok: true });
}

export async function handleListRuns(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT run_log.id, run_log.config_set_id, config_set.name as config_name, run_log.started_at, run_log.status, run_log.item_count, run_log.error_message, run_log.email_id FROM run_log LEFT JOIN config_set ON run_log.config_set_id = config_set.id ORDER BY run_log.id DESC LIMIT 50'
  ).all();

  return jsonResponse(rows.results ?? []);
}

export async function handleDeleteRun(env: Env, id: number): Promise<Response> {
  await env.DB.prepare('DELETE FROM run_log WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}

export async function handleDeleteRuns(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { ids?: number[] };
  const ids = body.ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return jsonResponse({ error: 'No run IDs provided' }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM run_log WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  return jsonResponse({ ok: true, deleted: ids.length });
}

export async function handleDeleteAllRuns(env: Env): Promise<Response> {
  await env.DB.prepare('DELETE FROM run_log').run();
  return jsonResponse({ ok: true });
}

export async function getEnabledConfigSets(env: Env, cron: string): Promise<ConfigSet[]> {
  const rows = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set WHERE enabled = 1 AND schedule_cron = ?'
  )
    .bind(cron)
    .all<ConfigSet>();
  return rows.results ?? [];
}

export async function runConfigSet(env: Env, config: ConfigSet): Promise<void> {
  const startedAt = new Date().toISOString();
  const runInsert = await env.DB.prepare(
    'INSERT INTO run_log (config_set_id, started_at, status, item_count) VALUES (?, ?, ?, ?)'
  )
    .bind(config.id, startedAt, 'running', 0)
    .run();
  const runId = runInsert.meta.last_row_id as number;

  try {
    const settings = await env.DB.prepare(
      'SELECT resend_api_key, gemini_api_key, default_sender FROM global_settings WHERE id = 1'
    ).first<GlobalSettings>();

    if (!settings?.resend_api_key || !settings?.gemini_api_key || !settings?.default_sender) {
      throw new Error('Global settings missing API keys or sender.');
    }

    const sources = safeParseJsonArray<Source>(config.sources_json);
    const recipients = safeParseJsonArray<string>(config.recipients_json);

    const items: NewsItem[] = [];
    for (const source of sources) {
      if (source.type === 'rss') {
        items.push(...(await fetchRssItems(source.url)));
      } else if (source.type === 'api') {
        items.push(...(await fetchApiItems(source.url, source.items_path)));
      }
    }

    const deduped = dedupeItems(items);
    const summary = await summarizeWithGemini(deduped, config.prompt, settings.gemini_api_key);
    const html = buildEmailHtml(config.name, summary, deduped);

    const emailId = await sendResendEmail(
      settings.resend_api_key,
      settings.default_sender,
      recipients,
      `News Digest: ${config.name}`,
      html
    );

    await env.DB.prepare('UPDATE run_log SET status = ?, item_count = ?, email_id = ? WHERE id = ?')
      .bind('sent', deduped.length, emailId, runId)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await env.DB.prepare('UPDATE run_log SET status = ?, error_message = ? WHERE id = ?')
      .bind('error', message, runId)
      .run();
  }
}

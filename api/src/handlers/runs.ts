import type { Env, ConfigSet, GlobalSettings, NewsItem, Source } from '../types';
import { getGlobalSettings } from '../services/global-settings';
import { safeParseJsonArray } from '../utils/parsing';
import { jsonResponse, escapeHtml } from '../utils/response';
import { fetchRssItems, fetchApiItems, dedupeItems, filterByLookback } from '../services/sources';
import { summarize } from '../services/llm';
import { buildEmailHtml, buildEmailText, sendResendEmail } from '../services/email';

const DEFAULT_RUN_TIMEOUT_MINUTES = 15;
const DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS = 30;
const RUN_STATUS_HISTORY_DEFAULT = '[]';
const RUN_FINAL_STATUSES = ['sent', 'success', 'error', 'failed', 'cancelled'] as const;

let runLogSchemaReadyPromise: Promise<void> | null = null;

type RunConfigSetResult = {
  runId: number;
  html: string;
};

type RunFailureNotification = {
  runId: number;
  config: ConfigSet;
  startedAt: string;
  failedAt: string;
  errorMessage: string;
  errorStack: string | null;
};

function getRunTimeoutMinutes(env: Env): number {
  const parsed = Number.parseInt(env.RUN_TIMEOUT_MINUTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUN_TIMEOUT_MINUTES;
}

function getSourceFetchTimeoutMs(env: Env): number {
  const parsed = Number.parseInt(env.SOURCE_FETCH_TIMEOUT_SECONDS ?? '', 10);
  const timeoutSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS;
  return timeoutSeconds * 1000;
}

async function ensureRunLogSchema(env: Env): Promise<void> {
  if (!runLogSchemaReadyPromise) {
    runLogSchemaReadyPromise = (async () => {
      const columnRows = await env.DB.prepare('PRAGMA table_info(run_log)').all<{
        name: string;
      }>();
      const existingColumns = new Set((columnRows.results ?? []).map((column) => column.name));

      if (!existingColumns.has('status_history_json')) {
        try {
          await env.DB.prepare(
            `ALTER TABLE run_log ADD COLUMN status_history_json TEXT NOT NULL DEFAULT '${RUN_STATUS_HISTORY_DEFAULT}'`
          ).run();
        } catch (error) {
          if (!(error instanceof Error) || !/duplicate column|already exists/i.test(error.message)) {
            throw error;
          }
        }
      }

      await env.DB.prepare(
        "UPDATE run_log SET status_history_json = json_array(status) WHERE status_history_json IS NULL OR trim(status_history_json) = ''"
      ).run();
    })().catch((error) => {
      runLogSchemaReadyPromise = null;
      throw error;
    });
  }

  await runLogSchemaReadyPromise;
}

async function appendRunStatus(env: Env, runId: number, status: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE run_log SET status = ?, status_history_json = json_insert(CASE WHEN json_valid(status_history_json) THEN status_history_json ELSE '[]' END, '$[#]', ?) WHERE id = ?"
  )
    .bind(status, status, runId)
    .run();
}

async function markTimedOutRuns(env: Env): Promise<void> {
  await ensureRunLogSchema(env);

  const timeoutMinutes = getRunTimeoutMinutes(env);
  const timeoutMessage = `Run timed out after ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}.`;
  const finalStatusesInClause = RUN_FINAL_STATUSES.map((status) => `'${status}'`).join(', ');

  await env.DB.prepare(
    `UPDATE run_log
     SET status = 'failed',
         status_history_json = json_insert(CASE WHEN json_valid(status_history_json) THEN status_history_json ELSE '[]' END, '$[#]', 'failed'),
         error_message = CASE
           WHEN error_message IS NULL OR trim(error_message) = '' THEN ?
           ELSE error_message
         END
     WHERE lower(trim(status)) NOT IN (${finalStatusesInClause})
       AND datetime(started_at) <= datetime('now', ?)`
  )
    .bind(timeoutMessage, `-${timeoutMinutes} minutes`)
    .run();
}

async function getConfigSources(db: D1Database, configSetId: number): Promise<Source[]> {
  const rows = await db
    .prepare(
      'SELECT s.* FROM source s JOIN config_set_source css ON s.id = css.source_id WHERE css.config_set_id = ? AND s.enabled = 1'
    )
    .bind(configSetId)
    .all<Source>();
  return rows.results ?? [];
}

function buildRunFailureEmailText(notification: RunFailureNotification): string {
  const lines = [
    'NewsBot run failed',
    '',
    `Run ID: ${notification.runId}`,
    `Config ID: ${notification.config.id}`,
    `Config Name: ${notification.config.name}`,
    `Started At (UTC): ${notification.startedAt}`,
    `Failed At (UTC): ${notification.failedAt}`,
    '',
    `Error: ${notification.errorMessage}`,
  ];

  if (notification.errorStack) {
    lines.push('', 'Stack Trace:', notification.errorStack);
  }

  return lines.join('\n');
}

function buildRunFailureEmailHtml(notification: RunFailureNotification): string {
  const stackTraceBlock = notification.errorStack
    ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a;">Stack Trace</h2>
       <pre style="margin:0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#1e293b;">${escapeHtml(notification.errorStack)}</pre>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NewsBot Run Failure</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f1f5f9;">
      <tr>
        <td align="center" style="padding:20px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="border-collapse:separate;width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;background:#7f1d1d;color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;opacity:0.9;">NewsBot Alert</p>
                <h1 style="margin:0;font-size:24px;line-height:1.3;">Run Failed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#0f172a;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">A scheduled or manual run failed. Details are below.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr><td style="padding:6px 0;font-size:14px;"><strong>Run ID:</strong> ${notification.runId}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;"><strong>Config ID:</strong> ${notification.config.id}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;"><strong>Config Name:</strong> ${escapeHtml(notification.config.name)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;"><strong>Started At (UTC):</strong> ${escapeHtml(notification.startedAt)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;"><strong>Failed At (UTC):</strong> ${escapeHtml(notification.failedAt)}</td></tr>
                </table>
                <h2 style="margin:20px 0 8px;font-size:16px;color:#0f172a;">Error</h2>
                <pre style="margin:0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#1e293b;">${escapeHtml(notification.errorMessage)}</pre>
                ${stackTraceBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendRunFailureNotification(
  settings: GlobalSettings | null,
  notification: RunFailureNotification
): Promise<void> {
  const adminEmail = settings?.admin_email?.trim();
  const resendApiKey = settings?.resend_api_key?.trim();
  const defaultSender = settings?.default_sender?.trim();

  if (!adminEmail || !resendApiKey || !defaultSender) {
    return;
  }

  const subject = `NewsBot Run Failed: ${notification.config.name}`;
  const text = buildRunFailureEmailText(notification);
  const html = buildRunFailureEmailHtml(notification);
  await sendResendEmail(resendApiKey, defaultSender, [adminEmail], subject, html, text);
}

export async function handleRunConfigSet(env: Env, id: number): Promise<Response> {
  await ensureRunLogSchema(env);
  await markTimedOutRuns(env);

  const config = await env.DB.prepare(
    'SELECT id, name, enabled, schedule_cron, prompt, recipients_json FROM config_set WHERE id = ?'
  )
    .bind(id)
    .first<ConfigSet>();

  if (!config) {
    return jsonResponse({ error: 'Config set not found' }, 404);
  }

  try {
    const result = await runConfigSet(env, config);
    return jsonResponse({ ok: true, run_id: result.runId, html: result.html });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

export async function handleListRuns(env: Env): Promise<Response> {
  await ensureRunLogSchema(env);
  await markTimedOutRuns(env);

  const rows = await env.DB.prepare(
    'SELECT run_log.id, run_log.config_set_id, config_set.name as config_name, run_log.started_at, run_log.status, run_log.status_history_json, run_log.item_count, run_log.error_message, run_log.email_id FROM run_log LEFT JOIN config_set ON run_log.config_set_id = config_set.id ORDER BY run_log.id DESC LIMIT 50'
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
  await ensureRunLogSchema(env);
  await markTimedOutRuns(env);

  const rows = await env.DB.prepare(
    "SELECT id, name, enabled, schedule_cron, prompt, recipients_json FROM config_set WHERE enabled = 1 AND (',' || schedule_cron || ',') LIKE ('%,' || ? || ',%')"
  )
    .bind(cron)
    .all<ConfigSet>();
  return rows.results ?? [];
}

export async function runConfigSet(env: Env, config: ConfigSet): Promise<RunConfigSetResult> {
  await ensureRunLogSchema(env);

  const startedAt = new Date().toISOString();
  const runInsert = await env.DB.prepare(
    'INSERT INTO run_log (config_set_id, started_at, status, status_history_json, item_count) VALUES (?, ?, ?, json_array(?), ?)'
  )
    .bind(config.id, startedAt, 'Starting run', 'Starting run', 0)
    .run();
  const runId = runInsert.meta.last_row_id as number;
  const updateStatus = async (status: string): Promise<void> => {
    await appendRunStatus(env, runId, status);
  };
  let settings: GlobalSettings | null = null;

  try {
    await updateStatus('Loading global settings');
    settings = await getGlobalSettings(env);

    if (!settings?.resend_api_key || !settings?.llm_api_key || !settings?.default_sender) {
      throw new Error('Global settings missing API keys or sender.');
    }

    await updateStatus('Loading sources and recipients');
    const sources = await getConfigSources(env.DB, config.id);
    const recipients = safeParseJsonArray<string>(config.recipients_json);
    const sourceFetchTimeoutMs = getSourceFetchTimeoutMs(env);
    const sourceItemsLimit = settings.source_items_limit;

    const items: NewsItem[] = [];
    let totalSourceItemsReported = 0;
    let totalSourceItemsProcessed = 0;
    for (const [sourceIndex, source] of sources.entries()) {
      const sourceLabel = source.name?.trim() || source.url;
      await updateStatus(
        `Fetching from source [${sourceLabel}] (${sourceIndex + 1}/${sources.length}, first ${sourceItemsLimit} items only)`
      );

      let sourceFetchResult: Awaited<ReturnType<typeof fetchRssItems>>;
      if (source.type === 'rss') {
        sourceFetchResult = await fetchRssItems(source.url, sourceItemsLimit, sourceFetchTimeoutMs);
      } else if (source.type === 'api') {
        sourceFetchResult = await fetchApiItems(
          source.url,
          source.items_path ?? undefined,
          sourceItemsLimit,
          sourceFetchTimeoutMs
        );
      } else {
        continue;
      }

      items.push(...sourceFetchResult.items);
      totalSourceItemsReported += sourceFetchResult.totalItemCount;
      totalSourceItemsProcessed += sourceFetchResult.processedItemCount;

      await updateStatus(
        `${items.length} items fetched so far (processed ${totalSourceItemsProcessed}/${totalSourceItemsReported} source items total, limit ${sourceItemsLimit} per source)`
      );
    }

    await updateStatus(
      `Deduplicating fetched items (${items.length} fetched from ${totalSourceItemsProcessed}/${totalSourceItemsReported} source items, limit ${sourceItemsLimit} per source)`
    );
    const deduped = dedupeItems(items);
    const lookbackDays = settings.source_lookback_days;
    const filtered = filterByLookback(deduped, lookbackDays);
    const lookbackLabel = lookbackDays ? `, lookback ${lookbackDays}d` : '';
    await updateStatus(
      `${filtered.length} items after dedup/filter (from ${totalSourceItemsProcessed}/${totalSourceItemsReported} source items, limit ${sourceItemsLimit} per source${lookbackLabel})`
    );
    await updateStatus('Summarizing content');
    const summary = await summarize(filtered, config.prompt, settings.llm_provider, settings.llm_api_key, settings.llm_model);
    await updateStatus('Generating html');
    const html = buildEmailHtml(config.name, summary, filtered);
    const text = buildEmailText(config.name, summary, filtered);
    await updateStatus(`Sending email to ${recipients.length} recipient(s)`);

    const emailId = await sendResendEmail(
      settings.resend_api_key,
      settings.default_sender,
      recipients,
      `News Digest: ${config.name}`,
      html,
      text
    );

    await env.DB.prepare(
      "UPDATE run_log SET status = ?, status_history_json = json_insert(CASE WHEN json_valid(status_history_json) THEN status_history_json ELSE '[]' END, '$[#]', ?), item_count = ?, email_id = ? WHERE id = ?"
    )
      .bind('sent', 'sent', filtered.length, emailId, runId)
      .run();
    return { runId, html };
  } catch (error) {
    console.error(`[runConfigSet] Config set ${config.id} ("${config.name}") failed:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack ?? null : null;
    const failedAt = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE run_log SET status = ?, status_history_json = json_insert(CASE WHEN json_valid(status_history_json) THEN status_history_json ELSE '[]' END, '$[#]', ?), error_message = ? WHERE id = ?"
    )
      .bind('error', 'error', message, runId)
      .run();

    if (!settings) {
      settings = await getGlobalSettings(env).catch(() => null);
    }

    try {
      await sendRunFailureNotification(settings, {
        runId,
        config,
        startedAt,
        failedAt,
        errorMessage: message,
        errorStack: stack,
      });
    } catch (notificationError) {
      console.error(`[runConfigSet] Failed to send failure notification for run ${runId}:`, notificationError);
    }

    throw error;
  }
}

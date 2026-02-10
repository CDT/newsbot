import type { Env, Source, SourceTestResult } from '../types';
import { jsonResponse } from '../utils/response';
import { fetchRssItems, fetchApiItems } from '../services/sources';
import { getGlobalSettings, parseSourceItemsLimit } from '../services/global-settings';

export async function handleListSources(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, name, type, url, items_path, enabled, last_tested_at, last_test_status, last_test_message, created_at FROM source ORDER BY id DESC'
  ).all<Source>();
  return jsonResponse(rows.results ?? []);
}

export async function handleGetSource(env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  const row = await env.DB.prepare(
    'SELECT id, name, type, url, items_path, enabled, last_tested_at, last_test_status, last_test_message, created_at FROM source WHERE id = ?'
  )
    .bind(id)
    .first<Source>();

  if (!row) {
    return jsonResponse({ error: 'Source not found' }, 404);
  }
  return jsonResponse(row);
}

export async function handleCreateSource(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<Source> | null;
  if (!body?.name || !body?.type || !body?.url) {
    return jsonResponse({ error: 'Missing required fields: name, type, url' }, 400);
  }

  if (body.type !== 'rss' && body.type !== 'api') {
    return jsonResponse({ error: 'Invalid type. Must be "rss" or "api"' }, 400);
  }

  const result = await env.DB.prepare(
    'INSERT INTO source (name, type, url, items_path, enabled) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(body.name, body.type, body.url, body.items_path ?? null, body.enabled ?? 1)
    .run();

  return jsonResponse({ ok: true, id: result.meta.last_row_id });
}

export async function handleUpdateSource(
  request: Request,
  env: Env,
  id: number
): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  const body = (await request.json().catch(() => null)) as Partial<Source> | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  if (body.type && body.type !== 'rss' && body.type !== 'api') {
    return jsonResponse({ error: 'Invalid type. Must be "rss" or "api"' }, 400);
  }

  await env.DB.prepare(
    'UPDATE source SET name = ?, type = ?, url = ?, items_path = ?, enabled = ? WHERE id = ?'
  )
    .bind(
      body.name ?? '',
      body.type ?? 'rss',
      body.url ?? '',
      body.items_path ?? null,
      body.enabled ?? 1,
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

export async function handleDeleteSource(env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: 'Invalid id' }, 400);
  }
  await env.DB.prepare('DELETE FROM source WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}

export async function handleTestSource(
  request: Request,
  env: Env,
  id?: number
): Promise<Response> {
  let sourceData: Partial<Source>;

  if (id !== undefined) {
    // Test existing source by ID
    if (!Number.isFinite(id)) {
      return jsonResponse({ error: 'Invalid id' }, 400);
    }
    const row = await env.DB.prepare('SELECT type, url, items_path FROM source WHERE id = ?')
      .bind(id)
      .first<Source>();

    if (!row) {
      return jsonResponse({ error: 'Source not found' }, 404);
    }
    sourceData = row;
  } else {
    // Test source from request body (for testing before saving)
    const body = (await request.json().catch(() => null)) as Partial<Source> | null;
    if (!body?.type || !body?.url) {
      return jsonResponse({ error: 'Missing required fields: type, url' }, 400);
    }
    sourceData = body;
  }

  const settings = await getGlobalSettings(env);
  const sourceItemsLimit = parseSourceItemsLimit(settings?.source_items_limit);
  const result = await testSourceFetch(sourceData.type!, sourceData.url!, sourceData.items_path, sourceItemsLimit);

  // Update last test status if testing an existing source
  if (id !== undefined) {
    await env.DB.prepare(
      'UPDATE source SET last_tested_at = datetime("now"), last_test_status = ?, last_test_message = ? WHERE id = ?'
    )
      .bind(
        result.success ? 'success' : 'error',
        result.success
          ? `Fetched ${result.item_count} items (processed ${result.processed_item_count ?? result.item_count}/${result.total_item_count ?? result.processed_item_count ?? result.item_count} source items, limit ${sourceItemsLimit})`
          : result.error ?? 'Unknown error',
        id
      )
      .run();
  }

  return jsonResponse(result);
}

async function testSourceFetch(
  type: string,
  url: string,
  itemsPath: string | null | undefined,
  sourceItemsLimit: number
): Promise<SourceTestResult> {
  try {
    let fetchResult: Awaited<ReturnType<typeof fetchRssItems>>;
    if (type === 'rss') {
      fetchResult = await fetchRssItems(url, sourceItemsLimit);
    } else if (type === 'api') {
      fetchResult = await fetchApiItems(url, itemsPath ?? undefined, sourceItemsLimit);
    } else {
      return { success: false, error: `Unknown source type: ${type}`, source_items_limit: sourceItemsLimit };
    }

    return {
      success: true,
      item_count: fetchResult.items.length,
      total_item_count: fetchResult.totalItemCount,
      processed_item_count: fetchResult.processedItemCount,
      source_items_limit: sourceItemsLimit,
      sample_items: fetchResult.items.slice(0, 3),
    };
  } catch (err) {
    console.error('[testSourceFetch] Error:', err);
    return {
      success: false,
      source_items_limit: sourceItemsLimit,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

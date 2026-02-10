import type { Env, GlobalSettings } from '../types';

type TableInfoRow = {
  name: string;
};

let ensureSchemaPromise: Promise<void> | null = null;

function isDuplicateColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('duplicate column') || message.includes('duplicate column name');
}

export function parseSourceItemsLimit(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export async function ensureGlobalSettingsSchema(env: Env): Promise<void> {
  if (ensureSchemaPromise) {
    await ensureSchemaPromise;
    return;
  }

  ensureSchemaPromise = (async () => {
    const tableInfo = await env.DB.prepare('PRAGMA table_info(global_settings)').all<TableInfoRow>();
    const existingColumns = new Set((tableInfo.results ?? []).map((column) => column.name));

    if (!existingColumns.has('admin_email')) {
      try {
        await env.DB.prepare('ALTER TABLE global_settings ADD COLUMN admin_email TEXT').run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          throw error;
        }
      }
    }

    if (!existingColumns.has('source_items_limit')) {
      try {
        await env.DB.prepare('ALTER TABLE global_settings ADD COLUMN source_items_limit INTEGER NOT NULL DEFAULT 20').run();
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          throw error;
        }
      }
    }
  })();

  try {
    await ensureSchemaPromise;
  } finally {
    ensureSchemaPromise = null;
  }
}

export async function getGlobalSettings(env: Env): Promise<GlobalSettings | null> {
  await ensureGlobalSettingsSchema(env);

  const row = await env.DB
    .prepare(
      'SELECT resend_api_key, llm_provider, llm_api_key, llm_model, default_sender, admin_email, source_items_limit FROM global_settings WHERE id = 1'
    )
    .first<Omit<GlobalSettings, 'source_items_limit'> & { source_items_limit: unknown }>();

  if (!row) {
    return null;
  }

  return {
    ...row,
    source_items_limit: parseSourceItemsLimit(row.source_items_limit),
  };
}

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

export async function ensureGlobalSettingsSchema(env: Env): Promise<void> {
  if (ensureSchemaPromise) {
    await ensureSchemaPromise;
    return;
  }

  ensureSchemaPromise = (async () => {
    const tableInfo = await env.DB.prepare('PRAGMA table_info(global_settings)').all<TableInfoRow>();
    const hasAdminEmailColumn = (tableInfo.results ?? []).some((column) => column.name === 'admin_email');
    if (hasAdminEmailColumn) {
      return;
    }

    try {
      await env.DB.prepare('ALTER TABLE global_settings ADD COLUMN admin_email TEXT').run();
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        throw error;
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

  return env.DB.prepare(
    'SELECT resend_api_key, llm_provider, llm_api_key, llm_model, default_sender, admin_email FROM global_settings WHERE id = 1'
  ).first<GlobalSettings>();
}

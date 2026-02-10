import type { Env, GlobalSettings } from '../types';
import { ensureGlobalSettingsSchema, getGlobalSettings } from '../services/global-settings';
import { jsonResponse } from '../utils/response';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  resend_api_key: null,
  llm_provider: 'gemini',
  llm_api_key: null,
  llm_model: null,
  default_sender: null,
  admin_email: null,
};

export async function handleGetGlobalSettings(env: Env): Promise<Response> {
  const row = await getGlobalSettings(env);
  return jsonResponse(row ?? DEFAULT_GLOBAL_SETTINGS);
}

export async function handleUpdateGlobalSettings(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<GlobalSettings> | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  await ensureGlobalSettingsSchema(env);
  await env.DB.prepare(
    'INSERT OR IGNORE INTO global_settings (id, resend_api_key, llm_provider, llm_api_key, llm_model, default_sender, admin_email) VALUES (1, ?, ?, ?, ?, ?, ?)'
  )
    .bind('', 'gemini', '', null, '', '')
    .run();

  await env.DB.prepare(
    'UPDATE global_settings SET resend_api_key = ?, llm_provider = ?, llm_api_key = ?, llm_model = ?, default_sender = ?, admin_email = ? WHERE id = 1'
  )
    .bind(
      body.resend_api_key ?? '',
      body.llm_provider ?? 'gemini',
      body.llm_api_key ?? '',
      body.llm_model ?? null,
      body.default_sender ?? '',
      body.admin_email ?? ''
    )
    .run();

  return jsonResponse({ ok: true });
}

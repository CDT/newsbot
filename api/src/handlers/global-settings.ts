import type { Env, GlobalSettings } from '../types';
import { jsonResponse } from '../utils/response';

export async function handleGetGlobalSettings(env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT resend_api_key, llm_provider, llm_api_key, llm_model, default_sender FROM global_settings WHERE id = 1'
  ).first<GlobalSettings>();
  return jsonResponse(row ?? { resend_api_key: null, llm_provider: 'gemini', llm_api_key: null, llm_model: null, default_sender: null });
}

export async function handleUpdateGlobalSettings(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<GlobalSettings> | null;
  if (!body) {
    return jsonResponse({ error: 'Invalid payload' }, 400);
  }

  await env.DB.prepare(
    'UPDATE global_settings SET resend_api_key = ?, llm_provider = ?, llm_api_key = ?, llm_model = ?, default_sender = ? WHERE id = 1'
  )
    .bind(body.resend_api_key ?? '', body.llm_provider ?? 'gemini', body.llm_api_key ?? '', body.llm_model ?? null, body.default_sender ?? '')
    .run();

  return jsonResponse({ ok: true });
}

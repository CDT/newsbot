import type { Env, GlobalSettings, LlmProvider } from '../types';
import { polishPrompt } from '../services/llm';
import { jsonResponse } from '../utils/response';

export async function handlePolishPrompt(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  if (!body?.prompt) {
    return jsonResponse({ error: 'Missing prompt' }, 400);
  }

  const settings = await env.DB.prepare(
    'SELECT llm_provider, llm_api_key, llm_model FROM global_settings WHERE id = 1'
  ).first<Pick<GlobalSettings, 'llm_provider' | 'llm_api_key' | 'llm_model'>>();

  if (!settings?.llm_api_key) {
    return jsonResponse({ error: 'LLM API key not configured in global settings' }, 400);
  }

  const polished = await polishPrompt(
    body.prompt,
    (settings.llm_provider ?? 'gemini') as LlmProvider,
    settings.llm_api_key,
    settings.llm_model
  );

  return jsonResponse({ polished });
}

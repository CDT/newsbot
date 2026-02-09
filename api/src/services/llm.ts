import type { NewsItem, LlmProvider } from '../types';

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
};

function buildItemsText(items: NewsItem[]): string {
  return items.map((item) => `- ${item.title}\n  ${item.summary ?? ''}\n  ${item.url}`).join('\n');
}

async function summarizeWithGemini(items: NewsItem[], prompt: string, apiKey: string, model: string): Promise<string> {
  const input = buildItemsText(items);
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nNews items:\n${input}` }] }],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!summary) throw new Error('Gemini response missing summary');
  return summary;
}

async function summarizeWithOpenAICompat(
  items: NewsItem[],
  prompt: string,
  apiKey: string,
  model: string,
  baseUrl: string
): Promise<string> {
  const input = buildItemsText(items);
  const body = {
    model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `News items:\n${input}` },
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = data.choices?.[0]?.message?.content;
  if (!summary) throw new Error('LLM response missing summary');
  return summary;
}

async function summarizeWithAnthropic(items: NewsItem[], prompt: string, apiKey: string, model: string): Promise<string> {
  const input = buildItemsText(items);
  const body = {
    model,
    max_tokens: 4096,
    system: prompt,
    messages: [{ role: 'user', content: `News items:\n${input}` }],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const summary = data.content?.find((b) => b.type === 'text')?.text;
  if (!summary) throw new Error('Anthropic response missing summary');
  return summary;
}

export async function summarize(
  items: NewsItem[],
  prompt: string,
  provider: LlmProvider,
  apiKey: string,
  model?: string | null
): Promise<string> {
  const resolvedModel = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'gemini':
      return summarizeWithGemini(items, prompt, apiKey, resolvedModel);
    case 'openai':
      return summarizeWithOpenAICompat(items, prompt, apiKey, resolvedModel, 'https://api.openai.com/v1');
    case 'deepseek':
      return summarizeWithOpenAICompat(items, prompt, apiKey, resolvedModel, 'https://api.deepseek.com');
    case 'anthropic':
      return summarizeWithAnthropic(items, prompt, apiKey, resolvedModel);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

const POLISH_SYSTEM_PROMPT =
  'You are a prompt engineer. Rewrite the following prompt to be clearer, more specific, and more effective for instructing an AI to summarize news items. Return ONLY the improved prompt text, nothing else.';

async function chatWithGemini(systemPrompt: string, userMessage: string, apiKey: string, model: string): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini response missing text');
  return text;
}

async function chatWithOpenAICompat(systemPrompt: string, userMessage: string, apiKey: string, model: string, baseUrl: string): Promise<string> {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('LLM response missing text');
  return text;
}

async function chatWithAnthropic(systemPrompt: string, userMessage: string, apiKey: string, model: string): Promise<string> {
  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Anthropic response missing text');
  return text;
}

export async function polishPrompt(
  prompt: string,
  provider: LlmProvider,
  apiKey: string,
  model?: string | null
): Promise<string> {
  const resolvedModel = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'gemini':
      return chatWithGemini(POLISH_SYSTEM_PROMPT, prompt, apiKey, resolvedModel);
    case 'openai':
      return chatWithOpenAICompat(POLISH_SYSTEM_PROMPT, prompt, apiKey, resolvedModel, 'https://api.openai.com/v1');
    case 'deepseek':
      return chatWithOpenAICompat(POLISH_SYSTEM_PROMPT, prompt, apiKey, resolvedModel, 'https://api.deepseek.com');
    case 'anthropic':
      return chatWithAnthropic(POLISH_SYSTEM_PROMPT, prompt, apiKey, resolvedModel);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

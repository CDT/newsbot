import type { LlmProvider, NewsItem } from '../types';
import { DEFAULT_LLM_MODELS } from '../config';

const QUERY_INDUCTION_SYSTEM_PROMPT =
  'You are a search query generator. Given a news digest prompt, produce a concise web search query (max 5-8 words) that would find the most relevant recent news articles. Return ONLY the search query text, nothing else.';

async function induceQueryWithGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: `${QUERY_INDUCTION_SYSTEM_PROMPT}\n\nPrompt:\n${prompt}` }] }],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API failed during query induction (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini response missing query text');
  return text.trim();
}

async function induceQueryWithOpenAICompat(
  prompt: string,
  apiKey: string,
  model: string,
  baseUrl: string
): Promise<string> {
  const body = {
    model,
    messages: [
      { role: 'system', content: QUERY_INDUCTION_SYSTEM_PROMPT },
      { role: 'user', content: `Prompt:\n${prompt}` },
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API failed during query induction (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('LLM response missing query text');
  return text.trim();
}

async function induceQueryWithAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const body = {
    model,
    max_tokens: 256,
    system: QUERY_INDUCTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Prompt:\n${prompt}` }],
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
    throw new Error(`Anthropic API failed during query induction (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Anthropic response missing query text');
  return text.trim();
}

export async function induceSearchQuery(
  prompt: string,
  provider: LlmProvider,
  apiKey: string,
  model?: string | null
): Promise<string> {
  const resolvedModel = model || DEFAULT_LLM_MODELS[provider];

  switch (provider) {
    case 'gemini':
      return induceQueryWithGemini(prompt, apiKey, resolvedModel);
    case 'openai':
      return induceQueryWithOpenAICompat(prompt, apiKey, resolvedModel, 'https://api.openai.com/v1');
    case 'deepseek':
      return induceQueryWithOpenAICompat(prompt, apiKey, resolvedModel, 'https://api.deepseek.com');
    case 'anthropic':
      return induceQueryWithAnthropic(prompt, apiKey, resolvedModel);
    default:
      throw new Error(`Unsupported LLM provider for query induction: ${provider}`);
  }
}

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  published_date?: string;
};

type TavilyResponse = {
  results?: TavilySearchResult[];
};

export async function searchTavily(apiKey: string, query: string, maxResults = 10): Promise<NewsItem[]> {
  const body = {
    query,
    max_results: maxResults,
    search_depth: 'basic',
    include_answer: false,
  };

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Tavily search failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as TavilyResponse;
  const results = data.results ?? [];

  return results.map((r) => ({
    title: r.title,
    url: r.url,
    summary: r.content,
    publishedAt: r.published_date ?? undefined,
  }));
}

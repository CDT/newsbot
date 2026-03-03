import type { NewsItem } from '../types';

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
    topic: 'news',
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

type SerpOrganicResult = {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
};

type SerpResponse = {
  organic_results?: SerpOrganicResult[];
};

export async function searchSerp(
  apiKey: string,
  query: string,
  engine = 'google',
  maxResults = 10
): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    engine,
    q: query,
    num: String(maxResults),
  });

  const response = await fetch(`https://serpapi.com/search?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SerpApi search failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as SerpResponse;
  const results = (data.organic_results ?? []).slice(0, maxResults);

  return results.map((r) => ({
    title: r.title,
    url: r.link,
    summary: r.snippet,
    publishedAt: r.date ?? undefined,
  }));
}

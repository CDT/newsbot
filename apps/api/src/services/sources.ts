import type { NewsItem } from '../types';
import { getPathValue } from '../utils/parsing';

export async function fetchRssItems(url: string): Promise<NewsItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${url}`);
  }
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const items = Array.from(doc.querySelectorAll('item')).map((item) => ({
    title: item.querySelector('title')?.textContent?.trim() ?? 'Untitled',
    url: item.querySelector('link')?.textContent?.trim() ?? '',
    publishedAt: item.querySelector('pubDate')?.textContent?.trim() ?? undefined,
    summary: item.querySelector('description')?.textContent?.trim() ?? undefined,
  }));

  return items.filter((item) => item.url);
}

export async function fetchApiItems(url: string, itemsPath?: string): Promise<NewsItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API fetch failed: ${url}`);
  }
  const data = await response.json();
  const items = itemsPath ? getPathValue(data, itemsPath) : data;
  if (!Array.isArray(items)) {
    throw new Error(`API response did not return an array for ${url}`);
  }
  return items
    .map((item) => ({
      title: String(item.title ?? 'Untitled'),
      url: String(item.url ?? item.link ?? ''),
      publishedAt: item.published_at ? String(item.published_at) : undefined,
      summary: item.summary ? String(item.summary) : undefined,
    }))
    .filter((item) => item.url);
}

export function dedupeItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

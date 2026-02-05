import type { NewsItem } from '../types';
import { getPathValue } from '../utils/parsing';

// DOMParser is available in Cloudflare Workers runtime
declare const DOMParser: {
  new (): {
    parseFromString(text: string, type: string): Document;
  };
};

interface Document {
  querySelectorAll(selector: string): Element[];
}

interface Element {
  querySelector(selector: string): Element | null;
  querySelectorAll(selector: string): Element[];
  getAttribute(name: string): string | null;
  textContent: string | null;
}

export async function fetchRssItems(url: string): Promise<NewsItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${url}`);
  }
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  // Try RSS format first (looks for <item> elements)
  const rssItems = doc.querySelectorAll('item');
  if (rssItems.length > 0) {
    return parseRssItems(rssItems);
  }

  // Try Atom format (looks for <entry> elements)
  const atomEntries = doc.querySelectorAll('entry');
  if (atomEntries.length > 0) {
    return parseAtomEntries(atomEntries);
  }

  return [];
}

function parseRssItems(items: Element[]): NewsItem[] {
  return items
    .map((item) => ({
      title: item.querySelector('title')?.textContent?.trim() ?? 'Untitled',
      url: item.querySelector('link')?.textContent?.trim() ?? '',
      publishedAt: item.querySelector('pubDate')?.textContent?.trim() ?? undefined,
      summary: item.querySelector('description')?.textContent?.trim() ?? undefined,
    }))
    .filter((item) => item.url);
}

function parseAtomEntries(entries: Element[]): NewsItem[] {
  return entries
    .map((entry) => {
      // Atom links use href attribute; prefer rel="alternate" or first link
      const links = entry.querySelectorAll('link');
      let url = '';
      for (const link of links) {
        const rel = link.getAttribute('rel');
        const href = link.getAttribute('href');
        if (href && (rel === 'alternate' || rel === null || !url)) {
          url = href;
          if (rel === 'alternate') break;
        }
      }

      // Atom uses <published> or <updated> for dates
      const publishedAt =
        entry.querySelector('published')?.textContent?.trim() ??
        entry.querySelector('updated')?.textContent?.trim() ??
        undefined;

      // Atom uses <summary> or <content> for description
      const summary =
        entry.querySelector('summary')?.textContent?.trim() ??
        entry.querySelector('content')?.textContent?.trim() ??
        undefined;

      return {
        title: entry.querySelector('title')?.textContent?.trim() ?? 'Untitled',
        url,
        publishedAt,
        summary,
      };
    })
    .filter((item) => item.url);
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

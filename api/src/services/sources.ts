import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../types';
import { getPathValue } from '../utils/parsing';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (_name, jpath) => {
    // Ensure items, entries, and links are always arrays
    return /\.(item|entry|link)$/.test(jpath);
  },
  trimValues: true,
});

const FETCH_HEADERS = { 'User-Agent': 'newsbot/1.0' };

const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Source fetch timed out after ${Math.ceil(timeoutMs / 1000)}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchRssItems(url: string, timeoutMs = DEFAULT_SOURCE_FETCH_TIMEOUT_MS): Promise<NewsItem[]> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[fetchRssItems] RSS fetch failed: ${url} (HTTP ${response.status}):`, body.slice(0, 500));
    throw new Error(
      `RSS fetch failed: ${url} (HTTP ${response.status} ${response.statusText})${body ? ' — ' + body.slice(0, 200) : ''}`
    );
  }
  const text = await response.text();
  const parsed = xmlParser.parse(text);

  // Try RSS format first (looks for rss > channel > item)
  const rssItems: unknown[] | undefined =
    parsed?.rss?.channel?.item ?? parsed?.rdf?.item;
  if (rssItems && rssItems.length > 0) {
    return parseRssItems(rssItems);
  }

  // Try Atom format (looks for feed > entry)
  const atomEntries: unknown[] | undefined = parsed?.feed?.entry;
  if (atomEntries && atomEntries.length > 0) {
    return parseAtomEntries(atomEntries);
  }

  return [];
}

interface RssItemRaw {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

function parseRssItems(items: unknown[]): NewsItem[] {
  return (items as RssItemRaw[])
    .map((item) => ({
      title: str(item.title) ?? 'Untitled',
      url: str(item.link) ?? '',
      publishedAt: str(item.pubDate) ?? undefined,
      summary: str(item.description) ?? undefined,
    }))
    .filter((item) => item.url);
}

interface AtomLinkRaw {
  '@_href'?: string;
  '@_rel'?: string;
}

interface AtomEntryRaw {
  title?: string | { '#text'?: string };
  link?: AtomLinkRaw[];
  published?: string;
  updated?: string;
  summary?: string | { '#text'?: string };
  content?: string | { '#text'?: string };
}

function parseAtomEntries(entries: unknown[]): NewsItem[] {
  return (entries as AtomEntryRaw[])
    .map((entry) => {
      // Atom links use href attribute; prefer rel="alternate" or first link
      const links = entry.link ?? [];
      let url = '';
      for (const link of links) {
        const href = link['@_href'];
        const rel = link['@_rel'];
        if (href && (rel === 'alternate' || !rel || !url)) {
          url = href;
          if (rel === 'alternate') break;
        }
      }

      const publishedAt = str(entry.published) ?? str(entry.updated) ?? undefined;
      const summary = textOf(entry.summary) ?? textOf(entry.content) ?? undefined;

      return {
        title: textOf(entry.title) ?? 'Untitled',
        url,
        publishedAt,
        summary,
      };
    })
    .filter((item) => item.url);
}

/** Coerce a value to a trimmed string, or null if empty/missing. */
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Extract text from a value that may be a plain string or { '#text': string }. */
function textOf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'object' && v !== null && '#text' in v) {
    return str((v as Record<string, unknown>)['#text']);
  }
  return str(v);
}

export async function fetchApiItems(
  url: string,
  itemsPath?: string,
  timeoutMs = DEFAULT_SOURCE_FETCH_TIMEOUT_MS
): Promise<NewsItem[]> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[fetchApiItems] API fetch failed: ${url} (HTTP ${response.status}):`, body.slice(0, 500));
    throw new Error(
      `API fetch failed: ${url} (HTTP ${response.status} ${response.statusText})${body ? ' — ' + body.slice(0, 200) : ''}`
    );
  }
  const data = await response.json();
  const items = itemsPath ? getPathValue(data, itemsPath) : data;
  if (!Array.isArray(items)) {
    console.error(`[fetchApiItems] Response is not an array for ${url}. Got:`, typeof items, JSON.stringify(items).slice(0, 300));
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

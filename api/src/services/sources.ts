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

import { DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS } from '../config';

const FETCH_HEADERS = { 'User-Agent': 'newsbot/1.0' };

const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS * 1000;

export type SourceFetchResult = {
  items: NewsItem[];
  totalItemCount: number;
  processedItemCount: number;
};

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

export async function fetchRssItems(
  url: string,
  itemsLimit: number,
  timeoutMs = DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
): Promise<SourceFetchResult> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[fetchRssItems] RSS fetch failed: ${url} (HTTP ${response.status}):`, body.slice(0, 500));
    throw new Error(
      `RSS fetch failed: ${url} (HTTP ${response.status} ${response.statusText})${body ? ' — ' + body.slice(0, 200) : ''}`,
    );
  }
  const text = await response.text();
  const parsed = xmlParser.parse(text);

  // Try RSS format first (looks for rss > channel > item)
  const rssItems: unknown[] | undefined = parsed?.rss?.channel?.item ?? parsed?.rdf?.item;
  if (rssItems && rssItems.length > 0) {
    const processedItemCount = Math.min(rssItems.length, itemsLimit);
    return {
      items: parseRssItems(rssItems.slice(0, itemsLimit)),
      totalItemCount: rssItems.length,
      processedItemCount,
    };
  }

  // Try Atom format (looks for feed > entry)
  const atomEntries: unknown[] | undefined = parsed?.feed?.entry;
  if (atomEntries && atomEntries.length > 0) {
    const processedItemCount = Math.min(atomEntries.length, itemsLimit);
    return {
      items: parseAtomEntries(atomEntries.slice(0, itemsLimit)),
      totalItemCount: atomEntries.length,
      processedItemCount,
    };
  }

  return {
    items: [],
    totalItemCount: 0,
    processedItemCount: 0,
  };
}

interface RssItemRaw {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

function parseRssItems(items: unknown[]): NewsItem[] {
  return (items as RssItemRaw[])
    .map((item) => {
      const raw = str(item.description);
      const extracted = raw ? extractImageAndStripHtml(raw) : null;
      return {
        title: str(item.title) ?? 'Untitled',
        url: str(item.link) ?? '',
        publishedAt: str(item.pubDate) ?? undefined,
        summary: extracted?.text || raw || undefined,
        imageUrl: extracted?.imageUrl,
      };
    })
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
      const rawSummary = textOf(entry.summary) ?? textOf(entry.content) ?? undefined;
      const extracted = rawSummary ? extractImageAndStripHtml(rawSummary) : null;

      return {
        title: textOf(entry.title) ?? 'Untitled',
        url,
        publishedAt,
        summary: extracted?.text || rawSummary || undefined,
        imageUrl: extracted?.imageUrl,
      };
    })
    .filter((item) => item.url);
}

/** Extract the first image URL and strip all HTML tags from a string. */
function extractImageAndStripHtml(html: string): {
  text: string;
  imageUrl?: string;
} {
  // Extract src from the first <img> tag
  const imgMatch = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i);
  let imageUrl: string | undefined;
  if (imgMatch?.[1]) {
    try {
      const parsed = new URL(imgMatch[1]);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        imageUrl = parsed.toString();
      }
    } catch {
      // ignore invalid URLs
    }
  }
  // Strip all HTML tags and collapse whitespace
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { text: text || (undefined as unknown as string), imageUrl };
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
  itemsPath: string | undefined,
  itemsLimit: number,
  timeoutMs = DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
): Promise<SourceFetchResult> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[fetchApiItems] API fetch failed: ${url} (HTTP ${response.status}):`, body.slice(0, 500));
    throw new Error(
      `API fetch failed: ${url} (HTTP ${response.status} ${response.statusText})${body ? ' — ' + body.slice(0, 200) : ''}`,
    );
  }
  const data = await response.json();
  const items = itemsPath ? getPathValue(data, itemsPath) : data;
  if (!Array.isArray(items)) {
    console.error(
      `[fetchApiItems] Response is not an array for ${url}. Got:`,
      typeof items,
      JSON.stringify(items).slice(0, 300),
    );
    throw new Error(`API response did not return an array for ${url}`);
  }
  const processedItemCount = Math.min(items.length, itemsLimit);
  return {
    items: items
      .slice(0, itemsLimit)
      .map((item) => {
        const rawSummary = item.summary ? String(item.summary) : undefined;
        const extracted = rawSummary ? extractImageAndStripHtml(rawSummary) : null;
        return {
          title: String(item.title ?? 'Untitled'),
          url: String(item.url ?? item.link ?? ''),
          publishedAt: item.published_at ? String(item.published_at) : undefined,
          summary: extracted?.text || rawSummary || undefined,
          imageUrl: extracted?.imageUrl,
        };
      })
      .filter((item) => item.url),
    totalItemCount: items.length,
    processedItemCount,
  };
}

/** Fetch dated article links from a conventional HTML listing page. */
export async function fetchWebPageItems(
  url: string,
  itemsLimit: number,
  timeoutMs = DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
): Promise<SourceFetchResult> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (!response.ok) {
    throw new Error(`Web page fetch failed: ${url} (HTTP ${response.status} ${response.statusText})`);
  }

  const items = parseWebPageItems(await response.text(), url);
  return {
    items: items.slice(0, itemsLimit),
    totalItemCount: items.length,
    processedItemCount: Math.min(items.length, itemsLimit),
  };
}

function parseWebPageItems(html: string, pageUrl: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const listItemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let listItem: RegExpExecArray | null;

  while ((listItem = listItemPattern.exec(html))) {
    const row = listItem[1];
    const dateMatch = row.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
    // Requiring a date excludes headers, navigation, and unrelated page chrome.
    if (!dateMatch) continue;

    const anchorMatch = row.match(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchorMatch) continue;

    const title = htmlToText(anchorMatch[3]);
    const href = decodeHtmlEntities(anchorMatch[2]).trim();
    if (!title || title.length < 3 || !href || /^(#|javascript:|mailto:)/i.test(href)) continue;

    let articleUrl: string;
    try {
      articleUrl = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(articleUrl) || seen.has(articleUrl)) continue;

    seen.add(articleUrl);
    items.push({
      title,
      url: articleUrl,
      publishedAt: dateMatch[1].replace(/[/.]/g, '-'),
    });
  }

  return items;
}

function htmlToText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

export function filterByLookback(items: NewsItem[], lookbackDays: number | null): NewsItem[] {
  if (!lookbackDays) return items;
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  return items.filter((item) => {
    if (!item.publishedAt) return true; // keep items with no date
    const date = new Date(item.publishedAt);
    return !Number.isNaN(date.getTime()) && date >= cutoff;
  });
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

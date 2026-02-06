/**
 * Safely parse a JSON array string, with fallback for Python-style single quotes.
 */
export function safeParseJsonArray<T>(jsonString: string): T[] {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    // Try converting single quotes to double quotes (Python-style arrays)
    try {
      const converted = jsonString.replace(/'/g, '"');
      return JSON.parse(converted);
    } catch (err2) {
      console.error('[safeParseJsonArray] Failed to parse JSON array:', jsonString.slice(0, 200), err2);
      return [];
    }
  }
}

export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return part.slice(name.length + 1);
    }
  }
  return null;
}

export function getPathValue(data: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce(
      (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
      data
    );
}

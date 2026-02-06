export const SESSION_KEY = "newsbot_session";

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Safely parse a JSON array string, with fallback for Python-style single quotes.
 * Returns an empty array if parsing fails.
 */
export function safeParseJsonArray(jsonString: string | null | undefined): unknown[] {
  if (!jsonString) return [];
  
  try {
    return JSON.parse(jsonString);
  } catch {
    // Try converting single quotes to double quotes (Python-style arrays)
    try {
      const converted = jsonString.replace(/'/g, '"');
      return JSON.parse(converted);
    } catch {
      return [];
    }
  }
}

import type { NewsItem } from '../types';

export async function summarizeWithGemini(
  items: NewsItem[],
  prompt: string,
  apiKey: string
): Promise<string> {
  const input = items.map((item) => `- ${item.title}\n  ${item.summary ?? ''}\n  ${item.url}`).join('\n');
  const body = {
    contents: [
      {
        parts: [{ text: `${prompt}\n\nNews items:\n${input}` }],
      },
    ],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[summarizeWithGemini] Gemini API failed (${response.status}):`, errorBody);
    throw new Error(`Gemini summarization failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!summary) {
    console.error('[summarizeWithGemini] Gemini response missing summary. Full response:', JSON.stringify(data));
    throw new Error('Gemini response missing summary');
  }

  return summary;
}

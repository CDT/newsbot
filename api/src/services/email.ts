import type { NewsItem } from '../types';
import { escapeHtml } from '../utils/response';

export function buildEmailHtml(title: string, summary: string, items: NewsItem[]): string {
  const list = items
    .map(
      (item) =>
        `<li><a href="${item.url}">${escapeHtml(item.title)}</a><br /><small>${escapeHtml(
          item.summary ?? ''
        )}</small></li>`
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(summary)}</p>
    <h3>Articles</h3>
    <ul>${list}</ul>
  </body>
</html>`;
}

export async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[sendResendEmail] Resend API failed (${response.status}):`, errorBody);
    throw new Error(
      `Resend API failed (HTTP ${response.status} ${response.statusText})${errorBody ? ' — ' + errorBody.slice(0, 300) : ''}`
    );
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    console.error('[sendResendEmail] Resend API response missing email id:', data);
    throw new Error('Resend API missing email id');
  }

  return data.id;
}

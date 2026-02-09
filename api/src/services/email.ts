import type { NewsItem } from '../types';
import { escapeHtml } from '../utils/response';

const ISSUE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const PUBLISHED_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

type SummaryBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function normalizeMultilineText(value: string): string {
  return value.replaceAll('\r\n', '\n').trim();
}

function oneLineText(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Fall through to harmless link target.
  }
  return '#';
}

function formatPublishedDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return PUBLISHED_DATE_FORMATTER.format(parsed);
}

function renderInlineMarkdown(value: string): string {
  const links: string[] = [];
  const withLinkTokens = value.replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, rawHref: string) => {
    const href = rawHref.trim().split(/\s+/)[0];
    const token = `@@NEWSBOTLINK${links.length}@@`;
    links.push(
      `<a href="${escapeHtml(sanitizeUrl(href))}" style="color:#1d4ed8;text-decoration:underline;">${escapeHtml(
        label.trim() || href
      )}</a>`
    );
    return token;
  });

  let rendered = escapeHtml(withLinkTokens)
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/__([^_]+)__/g, '<strong>$1</strong>')
    .replaceAll(/\*([^*]+)\*/g, '<em>$1</em>')
    .replaceAll(/_([^_]+)_/g, '<em>$1</em>')
    .replaceAll(/`([^`]+)`/g, '<code style="font-family:Menlo,Consolas,monospace;background-color:#e2e8f0;border-radius:4px;padding:1px 4px;font-size:0.92em;">$1</code>')
    .replaceAll(/~~([^~]+)~~/g, '<span style="text-decoration:line-through;">$1</span>');

  links.forEach((linkHtml, index) => {
    rendered = rendered.replaceAll(`@@NEWSBOTLINK${index}@@`, linkHtml);
  });

  return rendered;
}

function parseSummaryBlocks(summary: string): SummaryBlock[] {
  const normalized = normalizeMultilineText(summary);
  if (!normalized) return [];

  const blocks: SummaryBlock[] = [];
  const lines = normalized.split('\n');
  let paragraphLines: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = (): void => {
    if (!paragraphLines.length) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    paragraphLines = [];
  };

  const flushUnorderedItems = (): void => {
    if (!unorderedItems.length) return;
    blocks.push({ type: 'ul', items: unorderedItems });
    unorderedItems = [];
  };

  const flushOrderedItems = (): void => {
    if (!orderedItems.length) return;
    blocks.push({ type: 'ol', items: orderedItems });
    orderedItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushUnorderedItems();
      flushOrderedItems();
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushUnorderedItems();
      flushOrderedItems();
      if (headingMatch[1].trim()) {
        blocks.push({ type: 'heading', text: headingMatch[1].trim() });
      }
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushOrderedItems();
      unorderedItems.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushUnorderedItems();
      orderedItems.push(orderedMatch[1].trim());
      continue;
    }

    flushUnorderedItems();
    flushOrderedItems();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushUnorderedItems();
  flushOrderedItems();

  return blocks;
}

function renderSummaryHtml(summary: string): string {
  const blocks = parseSummaryBlocks(summary);

  if (!blocks.length) {
    return '<p style="margin:0;color:#475569;font-size:15px;line-height:1.65;">No summary was generated for this run.</p>';
  }

  return blocks
    .map((block) => {
      if (block.type === 'heading') {
        return `<p style="margin:0 0 10px;color:#0f172a;font-size:18px;line-height:1.35;font-weight:700;">${renderInlineMarkdown(block.text)}</p>`;
      }

      if (block.type === 'paragraph') {
        return `<p style="margin:0 0 12px;color:#1f2937;font-size:15px;line-height:1.65;">${renderInlineMarkdown(block.text)}</p>`;
      }

      if (block.type === 'ul') {
        const itemsHtml = block.items
          .map(
            (item) =>
              `<li style="margin:0 0 8px;color:#1f2937;font-size:15px;line-height:1.65;">${renderInlineMarkdown(item)}</li>`
          )
          .join('');
        return `<ul style="margin:0 0 12px 22px;padding:0;">${itemsHtml}</ul>`;
      }

      const itemsHtml = block.items
        .map(
          (item) =>
            `<li style="margin:0 0 8px;color:#1f2937;font-size:15px;line-height:1.65;">${renderInlineMarkdown(item)}</li>`
        )
        .join('');
      return `<ol style="margin:0 0 12px 22px;padding:0;">${itemsHtml}</ol>`;
    })
    .join('');
}

export function buildEmailHtml(title: string, summary: string, items: NewsItem[]): string {
  const issueDate = ISSUE_DATE_FORMATTER.format(new Date());
  const escapedTitle = escapeHtml(oneLineText(title) || 'News Digest');
  const preheader = escapeHtml(
    `${oneLineText(title) || 'News Digest'}: ${items.length} article${items.length === 1 ? '' : 's'} ready`
  );

  const summaryHtml = renderSummaryHtml(summary);

  const articlesHtml = items.length
    ? items
        .map((item, index) => {
          const articleTitle = escapeHtml(oneLineText(item.title) || 'Untitled article');
          const articleUrl = escapeHtml(sanitizeUrl(item.url));
          const publishedLabel = formatPublishedDate(item.publishedAt);
          const articleSummary = item.summary ? truncateText(oneLineText(item.summary), 240) : '';
          const metadata = [`Article ${index + 1}`];
          if (publishedLabel) metadata.push(publishedLabel);

          return `
              <tr>
                <td style="padding:0 28px 14px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;">
                        <p style="margin:0 0 10px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(
                          metadata.join(' | ')
                        )}</p>
                        <p style="margin:0 0 10px;font-size:19px;line-height:1.4;font-weight:700;">
                          <a href="${articleUrl}" style="color:#0f172a;text-decoration:none;">${articleTitle}</a>
                        </p>
                        ${
                          articleSummary
                            ? `<p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">${escapeHtml(articleSummary)}</p>`
                            : ''
                        }
                        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;">
                          <tr>
                            <td style="border-radius:8px;background-color:#1d4ed8;">
                              <a href="${articleUrl}" style="display:inline-block;padding:8px 14px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Read article</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
        })
        .join('')
    : `
          <tr>
            <td style="padding:0 28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;">
                <tr>
                  <td style="padding:20px;color:#334155;font-size:14px;line-height:1.6;">
                    No matching articles were found for this run.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef2ff;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${preheader}
    </span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#eef2ff;">
      <tr>
        <td align="center" style="padding:24px 10px;">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="border-collapse:separate;width:100%;max-width:680px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px;background-color:#0f172a;">
                <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">NewsBot Digest</p>
                <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;">${escapedTitle}</h1>
                <p style="margin:12px 0 0;color:#cbd5e1;font-size:14px;">${issueDate} | ${items.length} article${items.length === 1 ? '' : 's'}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 10px;">
                <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;">Summary</h2>
                ${summaryHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 8px;">
                <h2 style="margin:0;padding:0 28px 12px;color:#0f172a;font-size:20px;">Top Stories</h2>
              </td>
            </tr>
            ${articlesHtml}
            <tr>
              <td style="padding:10px 28px 24px;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                  You are receiving this email because you are on the recipient list for this NewsBot configuration.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildEmailText(title: string, summary: string, items: NewsItem[]): string {
  const issueDate = ISSUE_DATE_FORMATTER.format(new Date());
  const summaryText = normalizeMultilineText(summary);
  const lines: string[] = [
    `News Digest: ${oneLineText(title) || 'News Digest'}`,
    `Date: ${issueDate}`,
    `Articles: ${items.length}`,
    '',
    summaryText || 'No summary was generated for this run.',
    '',
    'Top Stories',
    '',
  ];

  if (!items.length) {
    lines.push('No matching articles were found for this run.');
    return lines.join('\n');
  }

  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${oneLineText(item.title) || 'Untitled article'}`);
    const publishedLabel = formatPublishedDate(item.publishedAt);
    if (publishedLabel) lines.push(`Published: ${publishedLabel}`);
    lines.push(`URL: ${item.url}`);
    if (item.summary) lines.push(`Summary: ${truncateText(oneLineText(item.summary), 300)}`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

export async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string,
  text?: string
): Promise<string> {
  const payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text?: string;
  } = { from, to, subject, html };

  if (text?.trim()) {
    payload.text = text;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error(`[sendResendEmail] Resend API failed (${response.status}):`, errorBody);
    throw new Error(
      `Resend API failed (HTTP ${response.status} ${response.statusText})${errorBody ? ' - ' + errorBody.slice(0, 300) : ''}`
    );
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    console.error('[sendResendEmail] Resend API response missing email id:', data);
    throw new Error('Resend API missing email id');
  }

  return data.id;
}

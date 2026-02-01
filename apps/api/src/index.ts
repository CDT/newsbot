export interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
}

type NewsItem = {
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

type ConfigSet = {
  id: number;
  name: string;
  enabled: number;
  schedule_cron: string;
  prompt: string;
  sources_json: string;
  recipients_json: string;
};

type GlobalSettings = {
  resend_api_key: string | null;
  gemini_api_key: string | null;
  default_sender: string | null;
};

const JSON_HEADERS = {
  "content-type": "application/json;charset=UTF-8",
};

const SESSION_COOKIE = "session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    if (url.pathname.startsWith("/api")) {
      const authError = await requireAuth(request, env);
      if (authError) {
        return authError;
      }
    }

    if (url.pathname === "/api/global-settings") {
      if (request.method === "GET") {
        return handleGetGlobalSettings(env);
      }
      if (request.method === "PUT") {
        return handleUpdateGlobalSettings(request, env);
      }
    }

    if (url.pathname === "/api/config-sets") {
      if (request.method === "GET") {
        return handleListConfigSets(env);
      }
      if (request.method === "POST") {
        return handleCreateConfigSet(request, env);
      }
    }

    if (url.pathname.startsWith("/api/config-sets/") && request.method === "PUT") {
      const id = Number(url.pathname.split("/").pop());
      return handleUpdateConfigSet(request, env, id);
    }

    if (url.pathname.startsWith("/api/config-sets/") && request.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      return handleDeleteConfigSet(env, id);
    }

    if (url.pathname.startsWith("/api/run/") && request.method === "POST") {
      const id = Number(url.pathname.split("/").pop());
      return handleRunConfigSet(env, id);
    }

    if (url.pathname === "/api/runs" && request.method === "GET") {
      return handleListRuns(env);
    }

    return new Response("Not Found", { status: 404 });
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const configs = await getEnabledConfigSets(env, event.cron);
    for (const config of configs) {
      ctx.waitUntil(runConfigSet(env, config));
    }
  },
};

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  if (!body?.username || !body?.password) {
    return jsonResponse({ error: "Missing credentials" }, 400);
  }

  if (body.username !== env.ADMIN_USERNAME || body.password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: "Invalid credentials" }, 401);
  }

  const token = await signJwt({ sub: body.username }, env.JWT_SECRET, TOKEN_TTL_SECONDS);
  const headers = new Headers({ ...JSON_HEADERS });
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=${TOKEN_TTL_SECONDS}`
  );

  return new Response(JSON.stringify({ ok: true, token }), { status: 200, headers });
}

async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = tokenFromHeader || getCookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return null;
}

async function handleGetGlobalSettings(env: Env): Promise<Response> {
  const row = await env.DB.prepare("SELECT resend_api_key, gemini_api_key, default_sender FROM global_settings WHERE id = 1")
    .first<GlobalSettings>();
  return jsonResponse(row ?? { resend_api_key: null, gemini_api_key: null, default_sender: null });
}

async function handleUpdateGlobalSettings(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<GlobalSettings> | null;
  if (!body) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  await env.DB.prepare(
    "UPDATE global_settings SET resend_api_key = ?, gemini_api_key = ?, default_sender = ? WHERE id = 1"
  )
    .bind(body.resend_api_key ?? "", body.gemini_api_key ?? "", body.default_sender ?? "")
    .run();

  return jsonResponse({ ok: true });
}

async function handleListConfigSets(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set ORDER BY id DESC"
  ).all<ConfigSet>();
  return jsonResponse(rows.results ?? []);
}

async function handleCreateConfigSet(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Partial<ConfigSet> | null;
  if (!body?.name || !body?.schedule_cron || !body?.prompt) {
    return jsonResponse({ error: "Missing fields" }, 400);
  }
  const sources = body.sources_json ?? "[]";
  const recipients = body.recipients_json ?? "[]";

  const result = await env.DB.prepare(
    "INSERT INTO config_set (name, enabled, schedule_cron, prompt, sources_json, recipients_json) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(body.name, body.enabled ? 1 : 0, body.schedule_cron, body.prompt, sources, recipients)
    .run();

  return jsonResponse({ ok: true, id: result.meta.last_row_id });
}

async function handleUpdateConfigSet(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: "Invalid id" }, 400);
  }
  const body = (await request.json().catch(() => null)) as Partial<ConfigSet> | null;
  if (!body) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  await env.DB.prepare(
    "UPDATE config_set SET name = ?, enabled = ?, schedule_cron = ?, prompt = ?, sources_json = ?, recipients_json = ? WHERE id = ?"
  )
    .bind(
      body.name ?? "",
      body.enabled ? 1 : 0,
      body.schedule_cron ?? "",
      body.prompt ?? "",
      body.sources_json ?? "[]",
      body.recipients_json ?? "[]",
      id
    )
    .run();

  return jsonResponse({ ok: true });
}

async function handleDeleteConfigSet(env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return jsonResponse({ error: "Invalid id" }, 400);
  }
  await env.DB.prepare("DELETE FROM config_set WHERE id = ?").bind(id).run();
  return jsonResponse({ ok: true });
}

async function handleRunConfigSet(env: Env, id: number): Promise<Response> {
  const config = await env.DB.prepare(
    "SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set WHERE id = ?"
  )
    .bind(id)
    .first<ConfigSet>();

  if (!config) {
    return jsonResponse({ error: "Config set not found" }, 404);
  }

  await runConfigSet(env, config);
  return jsonResponse({ ok: true });
}

async function handleListRuns(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT run_log.id, run_log.config_set_id, config_set.name as config_name, run_log.started_at, run_log.status, run_log.item_count, run_log.error_message, run_log.email_id FROM run_log LEFT JOIN config_set ON run_log.config_set_id = config_set.id ORDER BY run_log.id DESC LIMIT 50"
  ).all();

  return jsonResponse(rows.results ?? []);
}

async function getEnabledConfigSets(env: Env, cron: string): Promise<ConfigSet[]> {
  const rows = await env.DB.prepare(
    "SELECT id, name, enabled, schedule_cron, prompt, sources_json, recipients_json FROM config_set WHERE enabled = 1 AND schedule_cron = ?"
  )
    .bind(cron)
    .all<ConfigSet>();
  return rows.results ?? [];
}

async function runConfigSet(env: Env, config: ConfigSet): Promise<void> {
  const startedAt = new Date().toISOString();
  const runInsert = await env.DB.prepare(
    "INSERT INTO run_log (config_set_id, started_at, status, item_count) VALUES (?, ?, ?, ?)"
  )
    .bind(config.id, startedAt, "running", 0)
    .run();
  const runId = runInsert.meta.last_row_id as number;

  try {
    const settings = await env.DB.prepare(
      "SELECT resend_api_key, gemini_api_key, default_sender FROM global_settings WHERE id = 1"
    ).first<GlobalSettings>();

    if (!settings?.resend_api_key || !settings?.gemini_api_key || !settings?.default_sender) {
      throw new Error("Global settings missing API keys or sender.");
    }

    const sources = JSON.parse(config.sources_json) as Array<{ type: string; url: string; items_path?: string }>;
    const recipients = JSON.parse(config.recipients_json) as string[];

    const items: NewsItem[] = [];
    for (const source of sources) {
      if (source.type === "rss") {
        items.push(...(await fetchRssItems(source.url)));
      } else if (source.type === "api") {
        items.push(...(await fetchApiItems(source.url, source.items_path)));
      }
    }

    const deduped = dedupeItems(items);
    const summary = await summarizeWithGemini(deduped, config.prompt, settings.gemini_api_key);
    const html = buildEmailHtml(config.name, summary, deduped);

    const emailId = await sendResendEmail(
      settings.resend_api_key,
      settings.default_sender,
      recipients,
      `News Digest: ${config.name}`,
      html
    );

    await env.DB.prepare("UPDATE run_log SET status = ?, item_count = ?, email_id = ? WHERE id = ?")
      .bind("sent", deduped.length, emailId, runId)
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await env.DB.prepare("UPDATE run_log SET status = ?, error_message = ? WHERE id = ?")
      .bind("error", message, runId)
      .run();
  }
}

async function fetchRssItems(url: string): Promise<NewsItem[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${url}`);
  }
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const items = Array.from(doc.querySelectorAll("item")).map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() ?? "Untitled",
    url: item.querySelector("link")?.textContent?.trim() ?? "",
    publishedAt: item.querySelector("pubDate")?.textContent?.trim() ?? undefined,
    summary: item.querySelector("description")?.textContent?.trim() ?? undefined,
  }));

  return items.filter((item) => item.url);
}

async function fetchApiItems(url: string, itemsPath?: string): Promise<NewsItem[]> {
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
      title: String(item.title ?? "Untitled"),
      url: String(item.url ?? item.link ?? ""),
      publishedAt: item.published_at ? String(item.published_at) : undefined,
      summary: item.summary ? String(item.summary) : undefined,
    }))
    .filter((item) => item.url);
}

function getPathValue(data: unknown, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), data);
}

function dedupeItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

async function summarizeWithGemini(items: NewsItem[], prompt: string, apiKey: string): Promise<string> {
  const input = items
    .map((item) => `- ${item.title}\n  ${item.summary ?? ""}\n  ${item.url}`)
    .join("\n");
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
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error("Gemini summarization failed");
  }

  const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!summary) {
    throw new Error("Gemini response missing summary");
  }

  return summary;
}

function buildEmailHtml(title: string, summary: string, items: NewsItem[]): string {
  const list = items
    .map(
      (item) =>
        `<li><a href="${item.url}">${escapeHtml(item.title)}</a><br /><small>${escapeHtml(
          item.summary ?? ""
        )}</small></li>`
    )
    .join("");

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

async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    throw new Error("Resend API failed");
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Resend API missing email id");
  }

  return data.id;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return part.slice(name.length + 1);
    }
  }
  return null;
}

async function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + ttlSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const toSign = `${encodedHeader}.${encodedBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  const encodedSig = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${toSign}.${encodedSig}`;
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, encodedSig] = parts;
  const toVerify = `${encodedHeader}.${encodedBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = base64UrlDecodeBytes(encodedSig);
  const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(toVerify));
  if (!valid) return null;

  const payload = JSON.parse(base64UrlDecode(encodedBody)) as { exp?: number };
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return base64UrlEncodeBytes(bytes);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(input: string): string {
  const bytes = base64UrlDecodeBytes(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return binary;
}

function base64UrlDecodeBytes(input: string): Uint8Array {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

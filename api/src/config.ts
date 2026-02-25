import type { Env, GlobalSettings, LlmProvider } from './types';

// ── Session ──────────────────────────────────────────────────────────

export const DEFAULT_SESSION_TTL_DAYS = 7;

// ── Runs ─────────────────────────────────────────────────────────────

export const DEFAULT_RUN_TIMEOUT_MINUTES = 15;

// ── Source fetching ──────────────────────────────────────────────────

export const DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS = 30;

// ── LLM ──────────────────────────────────────────────────────────────

export const DEFAULT_LLM_MODELS: Record<LlmProvider, string> = {
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
};

// ── Schedules ────────────────────────────────────────────────────────

export type ScheduleOption = {
  cron: string;
  label: string;
};

export const ALLOWED_SCHEDULES: ScheduleOption[] = [
  { cron: '0 0 * * *', label: 'Daily at 08:00 UTC+8 (Wuhan)' },
  { cron: '0 1 * * *', label: 'Daily at 09:00 UTC+8 (Wuhan)' },
  { cron: '0 2 * * *', label: 'Daily at 10:00 UTC+8 (Wuhan)' },
  { cron: '0 7 * * *', label: 'Daily at 15:00 UTC+8 (Wuhan)' },
  { cron: '0 8 * * *', label: 'Daily at 16:00 UTC+8 (Wuhan)' },
];

const ALLOWED_SCHEDULE_SET = new Set(ALLOWED_SCHEDULES.map((o) => o.cron));

export function isAllowedScheduleCron(cron: string): boolean {
  return cron.split(',').every((part) => ALLOWED_SCHEDULE_SET.has(part.trim()));
}

// ── Global settings (DB row defaults) ────────────────────────────────

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  resend_api_key: null,
  llm_provider: 'gemini',
  llm_api_key: null,
  llm_model: null,
  default_sender: null,
  admin_email: null,
  source_items_limit: 20,
  source_lookback_days: null,
};

// ── Env-aware helpers ────────────────────────────────────────────────

function envPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSessionTtlSeconds(env: Env): number {
  return envPositiveNumber(env.SESSION_TTL_DAYS, DEFAULT_SESSION_TTL_DAYS) * 86400;
}

export function getRunTimeoutMinutes(env: Env): number {
  return envPositiveNumber(env.RUN_TIMEOUT_MINUTES, DEFAULT_RUN_TIMEOUT_MINUTES);
}

export function getSourceFetchTimeoutMs(env: Env): number {
  return envPositiveNumber(env.SOURCE_FETCH_TIMEOUT_SECONDS, DEFAULT_SOURCE_FETCH_TIMEOUT_SECONDS) * 1000;
}

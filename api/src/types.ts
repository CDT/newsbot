export interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
  RUN_TIMEOUT_MINUTES?: string;
  SOURCE_FETCH_TIMEOUT_SECONDS?: string;
}

export type NewsItem = {
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

export type ConfigSet = {
  id: number;
  name: string;
  enabled: number;
  schedule_cron: string;
  prompt: string;
  recipients_json: string;
};

export type LlmProvider = 'gemini' | 'deepseek' | 'openai' | 'anthropic';

export type GlobalSettings = {
  resend_api_key: string | null;
  llm_provider: LlmProvider;
  llm_api_key: string | null;
  llm_model: string | null;
  default_sender: string | null;
  admin_email: string | null;
};

export type Source = {
  id: number;
  name: string;
  type: 'rss' | 'api';
  url: string;
  items_path: string | null;
  enabled: number;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  created_at: string;
};

export type SourceTestResult = {
  success: boolean;
  item_count?: number;
  sample_items?: NewsItem[];
  error?: string;
};

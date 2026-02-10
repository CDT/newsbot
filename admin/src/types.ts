export type LlmProvider = 'gemini' | 'deepseek' | 'openai' | 'anthropic';

export type GlobalSettings = {
  resend_api_key: string | null;
  llm_provider: LlmProvider;
  llm_api_key: string | null;
  llm_model: string | null;
  default_sender: string | null;
  admin_email: string | null;
};

export type ConfigSet = {
  id: number;
  name: string;
  enabled: number;
  schedule_cron: string;
  prompt: string;
  source_ids: number[];
  recipients_json: string;
};

export type RunLog = {
  id: number;
  config_set_id: number;
  config_name?: string;
  started_at: string;
  status: string;
  item_count: number;
  error_message?: string | null;
  email_id?: string | null;
};

export type RunNowResponse = {
  ok: boolean;
  run_id?: number;
  html?: string;
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

export type NewsItem = {
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
};

export type SourceTestResult = {
  success: boolean;
  item_count?: number;
  sample_items?: NewsItem[];
  error?: string;
};

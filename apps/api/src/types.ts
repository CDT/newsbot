export interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
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
  sources_json: string;
  recipients_json: string;
};

export type GlobalSettings = {
  resend_api_key: string | null;
  gemini_api_key: string | null;
  default_sender: string | null;
};

export type Source = {
  type: string;
  url: string;
  items_path?: string;
};

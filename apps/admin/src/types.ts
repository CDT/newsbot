export type GlobalSettings = {
  resend_api_key: string | null;
  gemini_api_key: string | null;
  default_sender: string | null;
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

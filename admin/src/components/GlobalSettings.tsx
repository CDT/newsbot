import { useState } from "react";
import { Icons } from "../Icons";
import type { GlobalSettings as GlobalSettingsType, LlmProvider } from "../types";

const LLM_PROVIDERS: { value: LlmProvider; label: string; placeholder: string }[] = [
  { value: "gemini", label: "Google Gemini", placeholder: "AIza..." },
  { value: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
];

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: "gemini-2.0-flash",
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250929",
};

type GlobalSettingsProps = {
  settings: GlobalSettingsType;
  onSettingsChange: (settings: GlobalSettingsType) => void;
  onSave: (event: React.FormEvent) => void;
  loading: boolean;
};

export function GlobalSettings({ settings, onSettingsChange, onSave, loading }: GlobalSettingsProps) {
  const [showResendKey, setShowResendKey] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);
  const currentProvider = LLM_PROVIDERS.find((p) => p.value === settings.llm_provider) ?? LLM_PROVIDERS[0];

  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ marginBottom: 0 }}>Global Settings</h2>
      </div>
      <form onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group">
            <label>
              Resend API Key
              <span className="label-hint">(for sending emails)</span>
            </label>
            <div className="password-input-wrapper">
              <input
                type={showResendKey ? "text" : "password"}
                placeholder="re_..."
                value={settings.resend_api_key ?? ""}
                onChange={(event) => onSettingsChange({ ...settings, resend_api_key: event.target.value })}
              />
              <button type="button" className="password-toggle" onClick={() => setShowResendKey(!showResendKey)}>
                {showResendKey ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>
              LLM Provider
              <span className="label-hint">(for AI summaries)</span>
            </label>
            <select
              value={settings.llm_provider ?? "gemini"}
              onChange={(event) => {
                const provider = event.target.value as LlmProvider;
                onSettingsChange({
                  ...settings,
                  llm_provider: provider,
                  llm_model: DEFAULT_MODELS[provider],
                });
              }}
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>
              {currentProvider.label} API Key
            </label>
            <div className="password-input-wrapper">
              <input
                type={showLlmKey ? "text" : "password"}
                placeholder={currentProvider.placeholder}
                value={settings.llm_api_key ?? ""}
                onChange={(event) => onSettingsChange({ ...settings, llm_api_key: event.target.value })}
              />
              <button type="button" className="password-toggle" onClick={() => setShowLlmKey(!showLlmKey)}>
                {showLlmKey ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>
              Model
              <span className="label-hint">(leave empty for default)</span>
            </label>
            <input
              type="text"
              placeholder={DEFAULT_MODELS[settings.llm_provider ?? "gemini"]}
              value={settings.llm_model ?? ""}
              onChange={(event) => onSettingsChange({ ...settings, llm_model: event.target.value || null })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>
              Default Sender
              <span className="label-hint">(email from address)</span>
            </label>
            <input
              type="text"
              placeholder="News Digest <digest@yourdomain.com>"
              value={settings.default_sender ?? ""}
              onChange={(event) => onSettingsChange({ ...settings, default_sender: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Admin Email
              <span className="label-hint">(receives failed run logs)</span>
            </label>
            <input
              type="email"
              placeholder="admin@yourdomain.com"
              value={settings.admin_email ?? ""}
              onChange={(event) => onSettingsChange({ ...settings, admin_email: event.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Icons.Loader /> Saving...</> : <><Icons.Settings /> Save Settings</>}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

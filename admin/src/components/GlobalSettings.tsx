import { Icons } from "../Icons";
import type { GlobalSettings as GlobalSettingsType } from "../types";

type GlobalSettingsProps = {
  settings: GlobalSettingsType;
  onSettingsChange: (settings: GlobalSettingsType) => void;
  onSave: (event: React.FormEvent) => void;
  loading: boolean;
};

export function GlobalSettings({ settings, onSettingsChange, onSave, loading }: GlobalSettingsProps) {
  return (
    <section className="card">
      <h2>Global Settings</h2>
      <form onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group">
            <label>
              Resend API Key
              <span className="label-hint">(for sending emails)</span>
            </label>
            <input
              type="password"
              placeholder="re_..."
              value={settings.resend_api_key ?? ""}
              onChange={(event) => onSettingsChange({ ...settings, resend_api_key: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label>
              Gemini API Key
              <span className="label-hint">(for AI summaries)</span>
            </label>
            <input
              type="password"
              placeholder="AIza..."
              value={settings.gemini_api_key ?? ""}
              onChange={(event) => onSettingsChange({ ...settings, gemini_api_key: event.target.value })}
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

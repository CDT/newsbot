import { Icons } from "../Icons";
import type { ConfigSet } from "../types";

type ConfigSetFormProps = {
  configForm: ConfigSet;
  onConfigFormChange: (config: ConfigSet) => void;
  onSave: (event: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
};

export function ConfigSetForm({
  configForm,
  onConfigFormChange,
  onSave,
  onCancel,
  loading,
}: ConfigSetFormProps) {
  return (
    <form onSubmit={onSave} style={{ marginBottom: "24px", padding: "20px", background: "#f8fafc", borderRadius: "12px" }}>
      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            placeholder="Daily Tech Digest"
            value={configForm.name}
            onChange={(event) => onConfigFormChange({ ...configForm, name: event.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>
            Schedule
            <span className="label-hint">(cron expression)</span>
          </label>
          <input
            type="text"
            placeholder="0 8 * * *"
            value={configForm.schedule_cron}
            onChange={(event) => onConfigFormChange({ ...configForm, schedule_cron: event.target.value })}
            className="text-mono"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Prompt</label>
        <textarea
          placeholder="Describe how you want the AI to summarize the news..."
          value={configForm.prompt}
          onChange={(event) => onConfigFormChange({ ...configForm, prompt: event.target.value })}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Sources
            <span className="label-hint">(JSON array of RSS/URLs)</span>
          </label>
          <textarea
            className="code"
            placeholder='["https://example.com/feed.xml"]'
            value={configForm.sources_json}
            onChange={(event) => onConfigFormChange({ ...configForm, sources_json: event.target.value })}
          />
        </div>
        <div className="form-group">
          <label>
            Recipients
            <span className="label-hint">(JSON array of emails)</span>
          </label>
          <textarea
            className="code"
            placeholder='["user@example.com"]'
            value={configForm.recipients_json}
            onChange={(event) => onConfigFormChange({ ...configForm, recipients_json: event.target.value })}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div className="toggle-wrapper">
          <div
            className={`toggle ${configForm.enabled ? "active" : ""}`}
            onClick={() => onConfigFormChange({ ...configForm, enabled: configForm.enabled ? 0 : 1 })}
          />
          <span className="toggle-label">{configForm.enabled ? "Enabled" : "Disabled"}</span>
        </div>

        <div className="btn-group">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Icons.Loader /> : <Icons.Check />}
            {configForm.id ? "Update" : "Create"} Config
          </button>
        </div>
      </div>
    </form>
  );
}

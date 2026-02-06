import { Icons } from "../Icons";
import type { ConfigSet, Source } from "../types";

type ConfigSetFormProps = {
  configForm: ConfigSet;
  sources: Source[];
  onConfigFormChange: (config: ConfigSet) => void;
  onSave: (event: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
};

export function ConfigSetForm({
  configForm,
  sources,
  onConfigFormChange,
  onSave,
  onCancel,
  loading,
}: ConfigSetFormProps) {
  function toggleSource(sourceId: number) {
    const current = configForm.source_ids;
    const next = current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId];
    onConfigFormChange({ ...configForm, source_ids: next });
  }

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
            <span className="label-hint">({configForm.source_ids.length} selected)</span>
          </label>
          {sources.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
              No sources available. Add sources in the Sources tab first.
            </p>
          ) : (
            <div style={{
              maxHeight: "180px",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#fff",
            }}>
              {sources.map((source) => (
                <label
                  key={source.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.875rem",
                    background: configForm.source_ids.includes(source.id)
                      ? "#f0f9ff"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={configForm.source_ids.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  <span style={{ fontWeight: 500 }}>{source.name}</span>
                  <span style={{ color: "#94a3b8", fontSize: "0.75rem", marginLeft: "auto" }}>
                    {source.type.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>
          )}
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

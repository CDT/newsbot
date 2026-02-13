import { useMemo, useState } from "react";
import { Icons } from "../Icons";
import type { ConfigSet, ScheduleOption, Source } from "../types";

type ConfigSetFormProps = {
  configForm: ConfigSet;
  scheduleOptions: ScheduleOption[];
  sources: Source[];
  onConfigFormChange: (config: ConfigSet) => void;
  onSave: (event: React.FormEvent) => void;
  onCancel: () => void;
  onPolishPrompt: (prompt: string) => Promise<string>;
  loading: boolean;
};

export function ConfigSetForm({
  configForm,
  scheduleOptions,
  sources,
  onConfigFormChange,
  onSave,
  onCancel,
  onPolishPrompt,
  loading,
}: ConfigSetFormProps) {
  const [polishing, setPolishing] = useState(false);
  const [prePolishPrompt, setPrePolishPrompt] = useState<string | null>(null);
  const allowedCrons = useMemo(
    () => new Set(scheduleOptions.map((option) => option.cron)),
    [scheduleOptions]
  );
  const selectedCrons = useMemo(
    () =>
      new Set(
        configForm.schedule_cron
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0 && allowedCrons.has(part))
      ),
    [configForm.schedule_cron, allowedCrons]
  );

  async function handlePolish() {
    setPolishing(true);
    try {
      setPrePolishPrompt(configForm.prompt);
      const polished = await onPolishPrompt(configForm.prompt);
      onConfigFormChange({ ...configForm, prompt: polished });
    } catch {
      setPrePolishPrompt(null);
    } finally {
      setPolishing(false);
    }
  }

  function handleRestore() {
    if (prePolishPrompt !== null) {
      onConfigFormChange({ ...configForm, prompt: prePolishPrompt });
      setPrePolishPrompt(null);
    }
  }

  function toggleSource(sourceId: number) {
    const current = configForm.source_ids;
    const next = current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId];
    onConfigFormChange({ ...configForm, source_ids: next });
  }

  function toggleSchedule(cron: string) {
    const next = new Set(selectedCrons);
    if (next.has(cron)) {
      if (next.size <= 1) return;
      next.delete(cron);
    } else {
      next.add(cron);
    }
    onConfigFormChange({ ...configForm, schedule_cron: [...next].join(",") });
  }

  return (
    <form onSubmit={onSave} className="config-set-form">
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
            <span className="label-hint">({selectedCrons.size} selected)</span>
          </label>
          <div className="schedule-picker">
            {scheduleOptions.map((option) => {
              const hour = option.label.match(/(\d{2}:\d{2})/)?.[1] ?? option.cron;
              return (
                <label
                  key={option.cron}
                  className={`schedule-picker-item ${selectedCrons.has(option.cron) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCrons.has(option.cron)}
                    onChange={() => toggleSchedule(option.cron)}
                  />
                  <span>{hour}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="form-group">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label>Prompt</label>
          <span style={{ display: "flex", gap: "4px" }}>
            {prePolishPrompt !== null && !polishing && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRestore}
                style={{ fontSize: "0.75rem", padding: "2px 8px", gap: "4px" }}
              >
                <Icons.Refresh />
                Restore
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!configForm.prompt?.trim() || polishing}
              onClick={handlePolish}
              style={{ fontSize: "0.75rem", padding: "2px 8px", gap: "4px" }}
            >
              {polishing ? <Icons.Loader /> : <Icons.Wand />}
              {polishing ? "Polishing..." : "Polish"}
            </button>
          </span>
        </div>
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
            <p className="source-picker-empty">
              No sources available. Add sources in the Sources tab first.
            </p>
          ) : (
            <div className="source-picker">
              {sources.map((source) => (
                <label
                  key={source.id}
                  className={`source-picker-item ${configForm.source_ids.includes(source.id) ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={configForm.source_ids.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                  />
                  <span className="source-picker-name">{source.name}</span>
                  <span className="source-picker-type">{source.type.toUpperCase()}</span>
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

      <div className="form-footer">
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

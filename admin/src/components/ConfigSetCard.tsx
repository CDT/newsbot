import { useState } from "react";
import { Icons } from "../Icons";
import type { ConfigSet } from "../types";
import { safeParseJsonArray } from "../utils";

type ConfigSetCardProps = {
  config: ConfigSet;
  running: boolean;
  onEdit: (config: ConfigSet) => void;
  onRun: (id: number) => Promise<void>;
  onDelete: (id: number) => void;
};

export function ConfigSetCard({ config, running, onEdit, onRun, onDelete }: ConfigSetCardProps) {
  const [runError, setRunError] = useState<string | null>(null);
  const sourcesCount = config.source_ids.length;
  const recipientsCount = safeParseJsonArray(config.recipients_json).length;

  async function handleRun() {
    if (running) return;
    setRunError(null);
    try {
      await onRun(config.id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run config set");
    }
  }

  return (
    <div className="config-card">
      <div className="config-card-header">
        <div className="config-card-title">{config.name}</div>
        <span className={`badge ${config.enabled ? "badge-success" : "badge-default"}`}>
          <span className="badge-dot" />
          {config.enabled ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="config-card-meta">
        <div className="config-card-meta-item">
          <span className="icon"><Icons.Clock /></span>
          <code>{config.schedule_cron}</code>
        </div>
        <div className="config-card-meta-item">
          <span className="icon"><Icons.Zap /></span>
          {sourcesCount} sources
        </div>
        <div className="config-card-meta-item">
          <span className="icon"><Icons.Mail /></span>
          {recipientsCount} recipients
        </div>
      </div>

      <div className="config-card-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(config)}>
          <Icons.Edit /> Edit
        </button>
        <button className="btn btn-success btn-sm" disabled={running} onClick={handleRun}>
          {running ? <Icons.Loader /> : <Icons.Play />} {running ? "Running..." : "Run Now"}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(config.id)}>
          <Icons.Trash /> Delete
        </button>
      </div>

      {runError && (
        <div className="config-card-error">
          <Icons.AlertCircle /> {runError}
        </div>
      )}
    </div>
  );
}

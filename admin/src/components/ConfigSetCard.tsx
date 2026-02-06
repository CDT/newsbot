import { Icons } from "../Icons";
import type { ConfigSet } from "../types";
import { safeParseJsonArray } from "../utils";

type ConfigSetCardProps = {
  config: ConfigSet;
  onEdit: (config: ConfigSet) => void;
  onRun: (id: number) => void;
  onDelete: (id: number) => void;
};

export function ConfigSetCard({ config, onEdit, onRun, onDelete }: ConfigSetCardProps) {
  const sourcesCount = safeParseJsonArray(config.sources_json).length;
  const recipientsCount = safeParseJsonArray(config.recipients_json).length;

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
        <button className="btn btn-success btn-sm" onClick={() => onRun(config.id)}>
          <Icons.Play /> Run Now
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(config.id)}>
          <Icons.Trash /> Delete
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Icons } from "../Icons";
import type { ConfigSet } from "../types";
import { safeParseJsonArray } from "../utils";

type ConfigSetCardProps = {
  config: ConfigSet;
  running: boolean;
  progressMessages: string[];
  generatedEmailHtml?: string;
  onEdit: (config: ConfigSet) => void;
  onRun: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export function ConfigSetCard({
  config,
  running,
  progressMessages,
  generatedEmailHtml,
  onEdit,
  onRun,
  onDelete,
}: ConfigSetCardProps) {
  const [runError, setRunError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const sourcesCount = config.source_ids.length;
  const recipientsCount = safeParseJsonArray(config.recipients_json).length;

  useEffect(() => {
    if (!generatedEmailHtml) {
      setShowEmailPreview(false);
    }
  }, [generatedEmailHtml]);

  async function handleRun() {
    if (running) return;
    setRunError(null);
    try {
      await onRun(config.id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run config set");
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!confirm("Are you sure you want to delete this config set?")) return;
    setDeleting(true);
    try {
      await onDelete(config.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
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
            <span className="schedule-badges">
              {config.schedule_cron.split(",").map((cron) => {
                const trimmed = cron.trim();
                const hourMatch = trimmed.match(/^0\s+(\d+)\s/);
                const label = hourMatch ? `${String(Number(hourMatch[1]) + 8).padStart(2, "0")}:00` : trimmed;
                return <code key={trimmed} className="schedule-badge">{label}</code>;
              })}
            </span>
          </div>
          <div className="config-card-meta-item">
            <span className="icon"><Icons.Zap /></span>
            {sourcesCount} sources
          </div>
          <div className="config-card-meta-item">
            <span className="icon"><Icons.Mail /></span>
            {recipientsCount} recipients
          </div>
          {config.use_web_search ? (
            <div className="config-card-meta-item">
              <span className="icon"><Icons.Search /></span>
              Web search
            </div>
          ) : null}
        </div>

        <div className="config-card-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(config)}>
            <Icons.Edit /> Edit
          </button>
          <button className="btn btn-success btn-sm" disabled={running} onClick={handleRun}>
            {running ? <Icons.Loader /> : <Icons.Play />} {running ? "Running..." : "Run Now"}
          </button>
          <button className="btn btn-danger btn-sm" disabled={deleting} onClick={handleDelete}>
            {deleting ? <Icons.Loader /> : <Icons.Trash />} {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>

        {running && (
          <div className="config-card-progress">
            <div className="config-card-progress-title">
              <Icons.Loader /> Running details
            </div>
            {progressMessages.length > 0 ? (
              <div className="config-card-progress-list">
                {progressMessages.map((message, index) => (
                  <div key={`${message}-${index}`} className="config-card-progress-item">
                    {message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="config-card-progress-item">Starting run...</div>
            )}
          </div>
        )}

        {generatedEmailHtml && (
          <div className="config-card-preview">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEmailPreview(true)}>
              <Icons.Eye /> View Generated Email
            </button>
          </div>
        )}

        {runError && (
          <div className="config-card-error">
            <Icons.AlertCircle /> {runError}
          </div>
        )}
      </div>

      {showEmailPreview && generatedEmailHtml && (
        <div className="email-preview-overlay" onClick={() => setShowEmailPreview(false)}>
          <div className="email-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="email-preview-header">
              <div className="email-preview-title">Generated Email: {config.name}</div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => setShowEmailPreview(false)}
                aria-label="Close preview"
              >
                <Icons.X />
              </button>
            </div>
            <iframe
              className="email-preview-frame"
              title={`Generated email preview for ${config.name}`}
              srcDoc={generatedEmailHtml}
              sandbox=""
            />
          </div>
        </div>
      )}
    </>
  );
}

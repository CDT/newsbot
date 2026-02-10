import { useEffect, useState } from "react";
import { Icons } from "../Icons";
import type { ConfigSet, RunLog } from "../types";
import { safeParseJsonArray } from "../utils";

type ConfigSetCardProps = {
  config: ConfigSet;
  running: boolean;
  latestRun?: RunLog;
  progressMessages: string[];
  generatedEmailHtml?: string;
  onEdit: (config: ConfigSet) => void;
  onRun: (id: number) => Promise<void>;
  onDelete: (id: number) => void;
};

const FINAL_STATUSES = new Set(["sent", "success", "error", "failed", "cancelled"]);

function isFinalStatus(status: string): boolean {
  return FINAL_STATUSES.has(status.trim().toLowerCase());
}

export function ConfigSetCard({
  config,
  running,
  latestRun,
  progressMessages,
  generatedEmailHtml,
  onEdit,
  onRun,
  onDelete,
}: ConfigSetCardProps) {
  const [runError, setRunError] = useState<string | null>(null);
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

  const displayedProgressMessages = [...progressMessages];
  if (running && latestRun && !isFinalStatus(latestRun.status)) {
    if (displayedProgressMessages[displayedProgressMessages.length - 1] !== latestRun.status) {
      displayedProgressMessages.push(latestRun.status);
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

        {running && (
          <div className="config-card-progress">
            <div className="config-card-progress-title">
              <Icons.Loader /> Running details
            </div>
            {displayedProgressMessages.length > 0 ? (
              <div className="config-card-progress-list">
                {displayedProgressMessages.map((message, index) => (
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

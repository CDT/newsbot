import { useState } from "react";
import { Icons } from "../Icons";
import type { Source, SourceTestResult, NewsItem } from "../types";

type DeleteHandler = () => Promise<void>;

type SourceManagerProps = {
  sources: Source[];
  onSourcesChange: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<unknown>;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  testingId: number | null;
  setTestingId: (id: number | null) => void;
  testResult: SourceTestResult | null;
  setTestResult: (result: SourceTestResult | null) => void;
};

const emptySource: Omit<Source, "id" | "created_at" | "last_tested_at" | "last_test_status" | "last_test_message"> = {
  name: "",
  type: "rss",
  url: "",
  items_path: null,
  enabled: 1,
};

export function SourceManager({
  sources,
  onSourcesChange,
  apiFetch,
  setError,
  setNotice,
  testingId,
  setTestingId,
  testResult,
  setTestResult,
}: SourceManagerProps) {
  const [editMode, setEditMode] = useState(false);
  const [sourceForm, setSourceForm] = useState(emptySource);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (editingId) {
        await apiFetch(`/api/sources/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(sourceForm),
        });
        setNotice("Source updated successfully");
      } else {
        await apiFetch("/api/sources", {
          method: "POST",
          body: JSON.stringify(sourceForm),
        });
        setNotice("Source created successfully");
      }
      cancelEdit();
      onSourcesChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save source");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await apiFetch(`/api/sources/${id}`, { method: "DELETE" });
      setNotice("Source deleted");
      onSourcesChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete source");
    }
  }

  async function handleTest(source: Source | null) {
    setError(null);
    setTestResult(null);

    const targetId = source?.id ?? null;
    setTestingId(targetId);

    try {
      let result: SourceTestResult;
      if (source) {
        result = (await apiFetch(`/api/sources/${source.id}/test`, {
          method: "POST",
        })) as SourceTestResult;
        onSourcesChange();
      } else {
        result = (await apiFetch("/api/sources/test", {
          method: "POST",
          body: JSON.stringify(sourceForm),
        })) as SourceTestResult;
      }
      setTestResult(result);
      if (result.success) {
        if (result.total_item_count !== undefined) {
          const processedCount = result.processed_item_count ?? result.item_count ?? 0;
          const limitText = result.source_items_limit ?? processedCount;
          setNotice(
            `Test successful: ${result.item_count} items fetched (processed ${processedCount}/${result.total_item_count} source items, limit ${limitText})`
          );
        } else {
          const limitHint = result.source_items_limit
            ? ` (from first ${result.source_items_limit} source items)`
            : "";
          setNotice(`Test successful: ${result.item_count} items fetched${limitHint}`);
        }
      } else {
        setError(`Test failed: ${result.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test source");
    } finally {
      setTestingId(null);
    }
  }

  function startEdit(source: Source) {
    setSourceForm({
      name: source.name,
      type: source.type,
      url: source.url,
      items_path: source.items_path,
      enabled: source.enabled,
    });
    setEditingId(source.id);
    setEditMode(true);
    setTestResult(null);
  }

  function cancelEdit() {
    setSourceForm(emptySource);
    setEditingId(null);
    setEditMode(false);
    setTestResult(null);
  }

  function startNew() {
    setSourceForm(emptySource);
    setEditingId(null);
    setEditMode(true);
    setTestResult(null);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ marginBottom: 0 }}>Sources</h2>
        {!editMode && (
          <button className="btn btn-primary btn-sm" onClick={startNew}>
            + New Source
          </button>
        )}
      </div>

      {editMode && (
        <SourceForm
          sourceForm={sourceForm}
          editingId={editingId}
          loading={loading}
          testingId={testingId}
          testResult={testResult}
          onFormChange={setSourceForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          onTest={() => handleTest(null)}
        />
      )}

      {sources.length === 0 && !editMode ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Rss /></div>
          <div className="empty-state-title">No sources yet</div>
          <p className="empty-state-description">
            Add RSS feeds or API endpoints to aggregate news.
          </p>
        </div>
      ) : (
        <div className="grid grid-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onEdit={() => startEdit(source)}
              onDelete={() => handleDelete(source.id)}
              onTest={() => handleTest(source)}
              testing={testingId === source.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type SourceFormProps = {
  sourceForm: typeof emptySource;
  editingId: number | null;
  loading: boolean;
  testingId: number | null;
  testResult: SourceTestResult | null;
  onFormChange: (form: typeof emptySource) => void;
  onSave: (event: React.FormEvent) => void;
  onCancel: () => void;
  onTest: () => void;
};

function SourceForm({
  sourceForm,
  editingId,
  loading,
  testingId,
  testResult,
  onFormChange,
  onSave,
  onCancel,
  onTest,
}: SourceFormProps) {
  return (
    <form onSubmit={onSave} className="source-form">
      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            placeholder="Tech News Feed"
            value={sourceForm.name}
            onChange={(e) => onFormChange({ ...sourceForm, name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select
            value={sourceForm.type}
            onChange={(e) => onFormChange({ ...sourceForm, type: e.target.value as "rss" | "api" })}
          >
            <option value="rss">Web Feed (RSS/Atom)</option>
            <option value="api">JSON API</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>URL</label>
        <input
          type="url"
          placeholder="https://example.com/feed.xml"
          value={sourceForm.url}
          onChange={(e) => onFormChange({ ...sourceForm, url: e.target.value })}
          required
        />
      </div>

      {sourceForm.type === "api" && (
        <div className="form-group">
          <label>
            Items Path
            <span className="label-hint">(JSON path to items array, e.g., "data.articles")</span>
          </label>
          <input
            type="text"
            placeholder="data.items"
            value={sourceForm.items_path ?? ""}
            onChange={(e) => onFormChange({ ...sourceForm, items_path: e.target.value || null })}
          />
        </div>
      )}

      <div className="form-actions">
        <div className="toggle-wrapper">
          <div
            className={`toggle ${sourceForm.enabled ? "active" : ""}`}
            onClick={() => onFormChange({ ...sourceForm, enabled: sourceForm.enabled ? 0 : 1 })}
          />
          <span className="toggle-label">{sourceForm.enabled ? "Enabled" : "Disabled"}</span>
        </div>

        <div className="btn-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onTest}
            disabled={!sourceForm.url || testingId !== null}
          >
            {testingId === null ? <><Icons.Play /> Test</> : <><Icons.Loader /> Testing...</>}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Icons.Loader /> : <Icons.Check />}
            {editingId ? "Update" : "Create"} Source
          </button>
        </div>
      </div>

      {testResult && <TestResultDisplay result={testResult} />}
    </form>
  );
}

type SourceCardProps = {
  source: Source;
  onEdit: () => void;
  onDelete: DeleteHandler;
  onTest: () => void;
  testing: boolean;
};

function SourceCard({ source, onEdit, onDelete, onTest, testing }: SourceCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    if (!confirm("Are you sure you want to delete this source?")) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="source-card">
      <div className="source-card-header">
        <div className="source-card-title-row">
          <span className="source-card-icon">
            {source.type === "rss" ? <Icons.Rss /> : <Icons.Globe />}
          </span>
          <div className="source-card-title">{source.name}</div>
        </div>
        <div className="source-card-badges">
          <span className="badge badge-primary">{source.type.toUpperCase()}</span>
          <span className={`badge ${source.enabled ? "badge-success" : "badge-default"}`}>
            <span className="badge-dot" />
            {source.enabled ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="source-card-url">
        <Icons.ExternalLink />
        <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.url}>
          {source.url}
        </a>
      </div>

      {source.items_path && (
        <div className="source-card-path">
          <Icons.Zap />
          <span>Path:</span>
          <code>{source.items_path}</code>
        </div>
      )}

      {source.last_tested_at && (
        <div className={`source-test-badge ${source.last_test_status === "success" ? "success" : "error"}`}>
          {source.last_test_status === "success" ? <Icons.Check /> : <Icons.AlertCircle />}
          <span className="source-test-badge-text">{source.last_test_message}</span>
          <span className="source-test-badge-date">{new Date(source.last_tested_at).toLocaleString()}</span>
        </div>
      )}

      <div className="source-card-actions">
        <button className="btn btn-secondary btn-sm" onClick={onTest} disabled={testing}>
          {testing ? <Icons.Loader /> : <Icons.Play />} Test
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>
          <Icons.Edit /> Edit
        </button>
        <button className="btn btn-danger btn-sm" disabled={deleting} onClick={handleDelete}>
          {deleting ? <Icons.Loader /> : <Icons.Trash />} {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

function TestResultDisplay({ result }: { result: SourceTestResult }) {
  const successMessage = (() => {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (result.total_item_count !== undefined) {
      const processedCount = result.processed_item_count ?? result.item_count ?? 0;
      const limitText = result.source_items_limit ?? processedCount;
      return `Success: ${result.item_count} items fetched (processed ${processedCount}/${result.total_item_count} source items, limit ${limitText})`;
    }

    const limitHint = result.source_items_limit ? ` (from first ${result.source_items_limit} source items)` : "";
    return `Success: ${result.item_count} items fetched${limitHint}`;
  })();

  return (
    <div className={`test-result ${result.success ? "success" : "error"}`}>
      <div className="test-result-header">
        {result.success ? <Icons.Check /> : <Icons.AlertCircle />}
        {successMessage}
      </div>

      {result.success && result.sample_items && result.sample_items.length > 0 && (
        <div className="test-result-samples">
          <div className="test-result-samples-title">Sample Items:</div>
          {result.sample_items.map((item: NewsItem, index: number) => (
            <div key={index} className="test-result-sample-item">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.title}
                <Icons.ExternalLink />
              </a>
              {item.publishedAt && (
                <span className="sample-date">{new Date(item.publishedAt).toLocaleDateString()}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

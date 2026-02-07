import { useState } from "react";
import { Icons } from "../Icons";
import type { RunLog } from "../types";
import { RunItem } from "./RunItem";

type RunHistoryProps = {
  runs: RunLog[];
  onDeleteOne: (id: number) => void;
  onDeleteMultiple: (ids: number[]) => void;
  onDeleteAll: () => void;
};

export function RunHistory({
  runs,
  onDeleteOne,
  onDeleteMultiple,
  onDeleteAll,
}: RunHistoryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSelect = (id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === runs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runs.map((r) => r.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected run(s)?`)) return;
    onDeleteMultiple(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleDeleteAll = () => {
    if (!confirm("Delete all run history? This cannot be undone.")) return;
    onDeleteAll();
    setSelectedIds(new Set());
  };

  const handleDeleteOne = (id: number) => {
    if (!confirm("Delete this run?")) return;
    onDeleteOne(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const allSelected = runs.length > 0 && selectedIds.size === runs.length;

  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ marginBottom: 0 }}>Run History</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {runs.length > 0 && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSelectAll}
                title={allSelected ? "Deselect all" : "Select all"}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              {selectedIds.size > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSelected}
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDeleteAll}
                title="Delete all runs"
              >
                <Icons.Trash /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icons.Inbox />
          </div>
          <div className="empty-state-title">No runs yet</div>
          <p className="empty-state-description">
            Run a config set to see the execution history here.
          </p>
        </div>
      ) : (
        <div className="grid">
          {runs.map((run) => (
            <RunItem
              key={run.id}
              run={run}
              selected={selectedIds.has(run.id)}
              onSelect={handleSelect}
              onDelete={handleDeleteOne}
            />
          ))}
        </div>
      )}
    </section>
  );
}

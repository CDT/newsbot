import { useEffect, useState } from "react";
import { Icons } from "../Icons";
import type { RunLog } from "../types";
import { RunItem } from "./RunItem";

type RunHistoryProps = {
  runs: RunLog[];
  sourceItemsLimit: number;
  page: number;
  totalPages: number;
  totalRuns: number;
  onPageChange: (page: number) => void;
  onDeleteOne: (id: number) => Promise<void>;
  onDeleteMultiple: (ids: number[]) => Promise<void>;
  onDeleteAll: () => Promise<void>;
};

export function RunHistory({
  runs,
  sourceItemsLimit,
  page,
  totalPages,
  totalRuns,
  onPageChange,
  onDeleteOne,
  onDeleteMultiple,
  onDeleteAll,
}: RunHistoryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingRunIds, setDeletingRunIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

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

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || bulkDeleting) return;
    if (!confirm(`Delete ${selectedIds.size} selected run(s)?`)) return;
    setBulkDeleting(true);
    try {
      await onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (bulkDeleting) return;
    if (!confirm("Delete all run history? This cannot be undone.")) return;
    setBulkDeleting(true);
    try {
      await onDeleteAll();
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteOne = async (id: number) => {
    if (deletingRunIds.has(id)) return;
    if (!confirm("Delete this run?")) return;
    setDeletingRunIds((prev) => new Set(prev).add(id));
    try {
      await onDeleteOne(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setDeletingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
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
                  disabled={bulkDeleting}
                  onClick={handleDeleteSelected}
                >
                  {bulkDeleting ? <Icons.Loader /> : null} Delete Selected ({selectedIds.size})
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                disabled={bulkDeleting}
                onClick={handleDeleteAll}
                title="Delete all runs"
              >
                {bulkDeleting ? <Icons.Loader /> : <Icons.Trash />} Clear All
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
        <>
          <div className="grid">
            {runs.map((run) => (
              <RunItem
                key={run.id}
                run={run}
                sourceItemsLimit={sourceItemsLimit}
                selected={selectedIds.has(run.id)}
                deleting={deletingRunIds.has(run.id)}
                onSelect={handleSelect}
                onDelete={handleDeleteOne}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                &laquo; Prev
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
                <span className="pagination-total">
                  ({totalRuns} total)
                </span>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next &raquo;
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

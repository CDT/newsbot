import { Icons } from "../Icons";
import type { RunLog } from "../types";
import { formatDate } from "../utils";

type RunItemProps = {
  run: RunLog;
  sourceItemsLimit: number;
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  onDelete?: (id: number) => void;
};

export function RunItem({ run, sourceItemsLimit, selected, onSelect, onDelete }: RunItemProps) {
  const normalizedStatus = run.status.toLowerCase();
  const isSuccess = normalizedStatus === "sent" || normalizedStatus === "success";
  const isError = normalizedStatus === "error" || normalizedStatus === "failed";

  const getStatusClass = () => {
    if (isSuccess) return "success";
    if (isError) return "error";
    return "running";
  };

  const getStatusIcon = () => {
    if (isSuccess) return <Icons.Check />;
    if (isError) return <Icons.X />;
    return <Icons.Loader />;
  };

  const getBadgeClass = () => {
    if (isSuccess) return "badge-success";
    if (isError) return "badge-danger";
    return "badge-primary";
  };

  return (
    <div className="run-item">
      {onSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(e) => onSelect(run.id, e.target.checked)}
          className="run-item-checkbox"
        />
      )}
      <div className={`run-item-icon ${getStatusClass()}`}>
        {getStatusIcon()}
      </div>
      <div className="run-item-content">
        <div className="run-item-title">
          {run.config_name || `Config #${run.config_set_id}`}
        </div>
        <div className="run-item-details">
          <span>{formatDate(run.started_at)}</span>
          <span>{run.item_count} items processed</span>
          <span>Fetch limit: first {sourceItemsLimit}/source</span>
          {run.email_id && <span>Email: {run.email_id.slice(0, 12)}...</span>}
        </div>
        {run.error_message && (
          <div className="run-item-error">{run.error_message}</div>
        )}
      </div>
      <span className={`badge ${getBadgeClass()}`}>
        {run.status}
      </span>
      {onDelete && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onDelete(run.id)}
          title="Delete this run"
        >
          <Icons.Trash />
        </button>
      )}
    </div>
  );
}

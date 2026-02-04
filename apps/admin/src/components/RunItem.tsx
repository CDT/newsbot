import { Icons } from "../Icons";
import type { RunLog } from "../types";
import { formatDate } from "../utils";

type RunItemProps = {
  run: RunLog;
};

export function RunItem({ run }: RunItemProps) {
  const getStatusClass = () => {
    if (run.status === "success") return "success";
    if (run.status === "error") return "error";
    return "running";
  };

  const getStatusIcon = () => {
    if (run.status === "success") return <Icons.Check />;
    if (run.status === "error") return <Icons.X />;
    return <Icons.Loader />;
  };

  const getBadgeClass = () => {
    if (run.status === "success") return "badge-success";
    if (run.status === "error") return "badge-danger";
    return "badge-primary";
  };

  return (
    <div className="run-item">
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
          {run.email_id && <span>Email: {run.email_id.slice(0, 12)}...</span>}
        </div>
        {run.error_message && (
          <div className="run-item-error">{run.error_message}</div>
        )}
      </div>
      <span className={`badge ${getBadgeClass()}`}>
        {run.status}
      </span>
    </div>
  );
}

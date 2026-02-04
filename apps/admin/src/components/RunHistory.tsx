import { Icons } from "../Icons";
import type { RunLog } from "../types";
import { RunItem } from "./RunItem";

type RunHistoryProps = {
  runs: RunLog[];
  onRefresh: () => void;
};

export function RunHistory({ runs, onRefresh }: RunHistoryProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ marginBottom: 0 }}>Run History</h2>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Inbox /></div>
          <div className="empty-state-title">No runs yet</div>
          <p className="empty-state-description">
            Run a config set to see the execution history here.
          </p>
        </div>
      ) : (
        <div className="grid">
          {runs.map((run) => (
            <RunItem key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

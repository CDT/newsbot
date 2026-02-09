import { Icons } from "../Icons";
import type { ConfigSet, Source } from "../types";
import { ConfigSetCard } from "./ConfigSetCard";
import { ConfigSetForm } from "./ConfigSetForm";

type ConfigSetListProps = {
  configSets: ConfigSet[];
  runningConfigIds: ReadonlySet<number>;
  configForm: ConfigSet;
  editMode: boolean;
  loading: boolean;
  sources: Source[];
  onConfigFormChange: (config: ConfigSet) => void;
  onSaveConfig: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onStartEdit: (config: ConfigSet) => void;
  onNewConfig: () => void;
  onRunConfig: (id: number) => Promise<void>;
  onDeleteConfig: (id: number) => void;
  onPolishPrompt: (prompt: string) => Promise<string>;
};

export function ConfigSetList({
  configSets,
  runningConfigIds,
  configForm,
  editMode,
  loading,
  sources,
  onConfigFormChange,
  onSaveConfig,
  onCancelEdit,
  onStartEdit,
  onNewConfig,
  onRunConfig,
  onDeleteConfig,
  onPolishPrompt,
}: ConfigSetListProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 style={{ marginBottom: 0 }}>Config Sets</h2>
        {!editMode && (
          <button className="btn btn-primary btn-sm" onClick={onNewConfig}>
            + New Config
          </button>
        )}
      </div>

      {editMode && (
        <ConfigSetForm
          configForm={configForm}
          sources={sources}
          onConfigFormChange={onConfigFormChange}
          onSave={onSaveConfig}
          onCancel={onCancelEdit}
          onPolishPrompt={onPolishPrompt}
          loading={loading}
        />
      )}

      {configSets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icons.Layers /></div>
          <div className="empty-state-title">No config sets yet</div>
          <p className="empty-state-description">
            Create your first config set to start sending news digests.
          </p>
        </div>
      ) : (
        <div className="grid grid-2">
          {configSets.map((config) => (
            <ConfigSetCard
              key={config.id}
              config={config}
              running={runningConfigIds.has(config.id)}
              onEdit={onStartEdit}
              onRun={onRunConfig}
              onDelete={onDeleteConfig}
            />
          ))}
        </div>
      )}
    </section>
  );
}

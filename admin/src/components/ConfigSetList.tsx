import { Icons } from "../Icons";
import type { ConfigSet, Source } from "../types";
import { ConfigSetCard } from "./ConfigSetCard";
import { ConfigSetForm } from "./ConfigSetForm";

type ConfigSetListProps = {
  configSets: ConfigSet[];
  configForm: ConfigSet;
  editMode: boolean;
  loading: boolean;
  sources: Source[];
  onConfigFormChange: (config: ConfigSet) => void;
  onSaveConfig: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onStartEdit: (config: ConfigSet) => void;
  onNewConfig: () => void;
  onRunConfig: (id: number) => void;
  onDeleteConfig: (id: number) => void;
};

export function ConfigSetList({
  configSets,
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

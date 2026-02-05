import { useEffect, useMemo, useState } from "react";
import type { GlobalSettings as GlobalSettingsType, ConfigSet, RunLog, Source } from "./types";
import { useApi } from "./hooks/useApi";
import { SESSION_KEY } from "./utils";
import {
  Alert,
  ConfigSetList,
  GlobalSettings,
  Header,
  LoginScreen,
  RunHistory,
  SourceManager,
} from "./components";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState<GlobalSettingsType>({
    resend_api_key: "",
    gemini_api_key: "",
    default_sender: "",
  });
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const emptyConfig = useMemo<ConfigSet>(
    () => ({
      id: 0,
      name: "",
      enabled: 0,
      schedule_cron: "0 8 * * *",
      prompt: "Summarize these items for a daily briefing.",
      sources_json: "[]",
      recipients_json: "[]",
    }),
    []
  );
  const [configForm, setConfigForm] = useState<ConfigSet>(emptyConfig);
  const [editMode, setEditMode] = useState(false);

  const { apiFetch } = useApi(token);

  // Auto-dismiss notices
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (!token) return;
    void Promise.all([loadSettings(), loadConfigSets(), loadRuns(), loadSources()]);
  }, [token]);

  async function loadSettings() {
    const data = (await apiFetch("/api/global-settings")) as GlobalSettingsType;
    setSettings({
      resend_api_key: data.resend_api_key ?? "",
      gemini_api_key: data.gemini_api_key ?? "",
      default_sender: data.default_sender ?? "",
    });
  }

  async function loadConfigSets() {
    const data = (await apiFetch("/api/config-sets")) as ConfigSet[];
    setConfigSets(data);
  }

  async function loadRuns() {
    const data = (await apiFetch("/api/runs")) as RunLog[];
    setRuns(data);
  }

  async function loadSources() {
    const data = (await apiFetch("/api/sources")) as Source[];
    setSources(data);
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await apiFetch("/api/global-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setNotice("Settings saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfigSet(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (configForm.id) {
        await apiFetch(`/api/config-sets/${configForm.id}`, {
          method: "PUT",
          body: JSON.stringify(configForm),
        });
        setNotice("Config set updated successfully");
      } else {
        await apiFetch("/api/config-sets", {
          method: "POST",
          body: JSON.stringify(configForm),
        });
        setNotice("Config set created successfully");
      }
      setConfigForm(emptyConfig);
      setEditMode(false);
      await loadConfigSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config set");
    } finally {
      setLoading(false);
    }
  }

  async function deleteConfigSet(id: number) {
    if (!confirm("Are you sure you want to delete this config set?")) return;
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/config-sets/${id}`, { method: "DELETE" });
      await loadConfigSets();
      setNotice("Config set deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config set");
    }
  }

  async function triggerRun(id: number) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/run/${id}`, { method: "POST" });
      setNotice("Run started successfully");
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run config set");
    }
  }

  async function deleteRun(id: number) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/runs/${id}`, { method: "DELETE" });
      setNotice("Run deleted");
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete run");
    }
  }

  async function deleteRuns(ids: number[]) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/runs", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      setNotice(`Deleted ${ids.length} run(s)`);
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete runs");
    }
  }

  async function deleteAllRuns() {
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/runs/all", { method: "DELETE" });
      setNotice("All runs deleted");
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete all runs");
    }
  }

  function handleLogin(newToken: string) {
    setToken(newToken);
    setNotice("Successfully logged in");
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
  }

  function startEdit(config: ConfigSet) {
    setConfigForm(config);
    setEditMode(true);
  }

  function cancelEdit() {
    setConfigForm(emptyConfig);
    setEditMode(false);
  }

  // Login screen
  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Main app
  return (
    <div className="app-container">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <Header onLogout={logout} />

      <main className="app-main">
        {error && <Alert type="error" message={error} />}
        {notice && <Alert type="success" message={notice} />}

        <GlobalSettings
          settings={settings}
          onSettingsChange={setSettings}
          onSave={saveSettings}
          loading={loading}
        />

        <SourceManager
          sources={sources}
          onSourcesChange={loadSources}
          apiFetch={apiFetch}
          setError={setError}
          setNotice={setNotice}
        />

        <ConfigSetList
          configSets={configSets}
          configForm={configForm}
          editMode={editMode}
          loading={loading}
          onConfigFormChange={setConfigForm}
          onSaveConfig={saveConfigSet}
          onCancelEdit={cancelEdit}
          onStartEdit={startEdit}
          onNewConfig={() => setEditMode(true)}
          onRunConfig={triggerRun}
          onDeleteConfig={deleteConfigSet}
        />

        <RunHistory
          runs={runs}
          onRefresh={loadRuns}
          onDeleteOne={deleteRun}
          onDeleteMultiple={deleteRuns}
          onDeleteAll={deleteAllRuns}
        />
      </main>
    </div>
  );
}

export default App;

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GlobalSettings as GlobalSettingsType, ConfigSet, RunLog, RunNowResponse, Source } from "./types";
import { useApi } from "./hooks/useApi";
import { useTheme } from "./hooks/useTheme";
import { SESSION_KEY } from "./utils";
import {
  Alert,
  ConfigSetList,
  GlobalSettings,
  Header,
  LoginScreen,
  RunHistory,
  SourceManager,
  TabBar,
} from "./components";
import type { TabId } from "./components";

function isRunInProgress(status: string): boolean {
  const normalizedStatus = status.toLowerCase();
  return !["sent", "success", "error", "failed", "cancelled"].includes(normalizedStatus);
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('configs');
  const [tabLoading, setTabLoading] = useState<Partial<Record<TabId, boolean>>>({});

  const [settings, setSettings] = useState<GlobalSettingsType>({
    resend_api_key: "",
    llm_provider: "gemini",
    llm_api_key: "",
    llm_model: null,
    default_sender: "",
  });
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [runningConfigIds, setRunningConfigIds] = useState<Set<number>>(new Set());
  const [generatedEmailHtmlByConfigId, setGeneratedEmailHtmlByConfigId] = useState<Record<number, string>>({});

  const emptyConfig = useMemo<ConfigSet>(
    () => ({
      id: 0,
      name: "",
      enabled: 0,
      schedule_cron: "0 8 * * *",
      prompt: "Summarize these items for a daily briefing.",
      source_ids: [],
      recipients_json: "[]",
    }),
    []
  );
  const [configForm, setConfigForm] = useState<ConfigSet>(emptyConfig);
  const [editMode, setEditMode] = useState(false);

  const { apiFetch } = useApi(token);
  const { theme, toggleTheme } = useTheme();
  const runningConfigIdsFromRuns = useMemo(() => {
    const ids = new Set<number>();
    for (const run of runs) {
      if (isRunInProgress(run.status)) {
        ids.add(run.config_set_id);
      }
    }
    return ids;
  }, [runs]);

  const activeRunningConfigIds = useMemo(() => {
    const ids = new Set<number>(runningConfigIds);
    for (const id of runningConfigIdsFromRuns) {
      ids.add(id);
    }
    return ids;
  }, [runningConfigIds, runningConfigIdsFromRuns]);
  const latestRunsByConfigId = useMemo(() => {
    const byConfig = new Map<number, RunLog>();
    for (const run of runs) {
      if (!byConfig.has(run.config_set_id)) {
        byConfig.set(run.config_set_id, run);
      }
    }
    return byConfig;
  }, [runs]);

  const withTabLoading = useCallback(
    <T,>(tab: TabId, fn: () => Promise<T>) => async () => {
      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      try {
        return await fn();
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    []
  );

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

  useEffect(() => {
    if (!token || activeRunningConfigIds.size === 0) return;

    let cancelled = false;
    const pollRuns = async () => {
      try {
        const data = (await apiFetch("/api/runs")) as RunLog[];
        if (!cancelled) {
          setRuns(data);
        }
      } catch {
        // Ignore polling errors during active runs.
      }
    };

    void pollRuns();
    const timer = window.setInterval(() => {
      void pollRuns();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, activeRunningConfigIds.size, apiFetch]);

  async function loadSettings() {
    return withTabLoading("settings", async () => {
      const data = (await apiFetch("/api/global-settings")) as GlobalSettingsType;
      setSettings({
        resend_api_key: data.resend_api_key ?? "",
        llm_provider: data.llm_provider ?? "gemini",
        llm_api_key: data.llm_api_key ?? "",
        llm_model: data.llm_model ?? null,
        default_sender: data.default_sender ?? "",
      });
    })();
  }

  async function loadConfigSets() {
    return withTabLoading("configs", async () => {
      const data = (await apiFetch("/api/config-sets")) as ConfigSet[];
      setConfigSets(data);
    })();
  }

  async function loadRuns() {
    return withTabLoading("history", async () => {
      const data = (await apiFetch("/api/runs")) as RunLog[];
      setRuns(data);
    })();
  }

  async function loadSources() {
    return withTabLoading("sources", async () => {
      const data = (await apiFetch("/api/sources")) as Source[];
      setSources(data);
    })();
  }

  function reloadTab(tab: TabId) {
    const loaders: Record<TabId, () => Promise<void>> = {
      settings: loadSettings,
      sources: loadSources,
      configs: loadConfigSets,
      history: loadRuns,
    };
    loaders[tab]();
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
    if (activeRunningConfigIds.has(id)) {
      return;
    }

    setNotice(null);
    setRunningConfigIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const data = (await apiFetch(`/api/run/${id}`, { method: "POST" })) as RunNowResponse;
      const generatedHtml = data.html;
      if (generatedHtml) {
        setGeneratedEmailHtmlByConfigId((prev) => ({ ...prev, [id]: generatedHtml }));
      }
      setNotice("Run completed successfully");
      await loadRuns();
    } finally {
      setRunningConfigIds((prev) => {
        if (!prev.has(id)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  async function polishPrompt(prompt: string): Promise<string> {
    const data = (await apiFetch("/api/polish-prompt", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    })) as { polished: string };
    return data.polished;
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

      <Header onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />

      <main className="app-main">
        {error && <Alert type="error" message={error} />}
        {notice && <Alert type="success" message={notice} />}

        <TabBar activeTab={activeTab} onTabChange={setActiveTab} onReload={reloadTab} loadingTabs={tabLoading} />

        {activeTab === 'settings' && (
          <GlobalSettings
            settings={settings}
            onSettingsChange={setSettings}
            onSave={saveSettings}
            loading={loading}
          />
        )}

        {activeTab === 'sources' && (
          <SourceManager
            sources={sources}
            onSourcesChange={loadSources}
            apiFetch={apiFetch}
            setError={setError}
            setNotice={setNotice}
          />
        )}

        {activeTab === 'configs' && (
          <ConfigSetList
            configSets={configSets}
            runningConfigIds={activeRunningConfigIds}
            latestRunsByConfigId={latestRunsByConfigId}
            generatedEmailHtmlByConfigId={generatedEmailHtmlByConfigId}
            configForm={configForm}
            editMode={editMode}
            loading={loading}
            sources={sources}
            onConfigFormChange={setConfigForm}
            onSaveConfig={saveConfigSet}
            onCancelEdit={cancelEdit}
            onStartEdit={startEdit}
            onNewConfig={() => setEditMode(true)}
            onRunConfig={triggerRun}
            onDeleteConfig={deleteConfigSet}
            onPolishPrompt={polishPrompt}
          />
        )}

        {activeTab === 'history' && (
          <RunHistory
            runs={runs}
            onDeleteOne={deleteRun}
            onDeleteMultiple={deleteRuns}
            onDeleteAll={deleteAllRuns}
          />
        )}
      </main>
    </div>
  );
}

export default App;

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GlobalSettings as GlobalSettingsType,
  ConfigSet,
  RunLog,
  RunNowResponse,
  ScheduleOption,
  Source,
  SourceTestResult,
} from "./types";
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

const FINAL_RUN_STATUSES = new Set(["sent", "success", "error", "failed", "cancelled"]);
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
type RunProgressByConfigId = Record<number, { runId: number; messages: string[] }>;
const FALLBACK_SCHEDULE_OPTIONS: ScheduleOption[] = [
  { cron: "0 0 * * *", label: "Daily at 08:00 UTC+8 (Wuhan)" },
  { cron: "0 1 * * *", label: "Daily at 09:00 UTC+8 (Wuhan)" },
  { cron: "0 2 * * *", label: "Daily at 10:00 UTC+8 (Wuhan)" },
  { cron: "0 7 * * *", label: "Daily at 15:00 UTC+8 (Wuhan)" },
  { cron: "0 8 * * *", label: "Daily at 16:00 UTC+8 (Wuhan)" },
];

function normalizeScheduleCronForOptions(scheduleCron: string, scheduleOptions: ScheduleOption[]): string {
  if (scheduleOptions.length === 0) {
    return scheduleCron;
  }

  const allowedCrons = new Set(scheduleOptions.map((option) => option.cron));
  const selected = Array.from(
    new Set(
      scheduleCron
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0 && allowedCrons.has(part))
    )
  );

  if (selected.length > 0) {
    return selected.join(",");
  }

  return scheduleOptions[0].cron;
}

function isRunInProgress(run: RunLog, nowMs = Date.now()): boolean {
  const normalizedStatus = run.status.trim().toLowerCase();
  if (FINAL_RUN_STATUSES.has(normalizedStatus)) {
    return false;
  }

  const startedAtMs = Date.parse(run.started_at);
  if (Number.isNaN(startedAtMs)) {
    return false;
  }

  return nowMs - startedAtMs < RUN_TIMEOUT_MS;
}

function getRunStatusMessages(run: RunLog): string[] {
  const rawHistory = run.status_history_json;
  if (typeof rawHistory === "string" && rawHistory.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) {
        const messages = parsed.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        );
        if (messages.length > 0) {
          return messages;
        }
      }
    } catch {
      // Fall through to status string fallback.
    }
  }
  return run.status ? [run.status] : [];
}

function sameMessages(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
    admin_email: "",
    source_items_limit: 20,
    source_lookback_days: null,
  });
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>(FALLBACK_SCHEDULE_OPTIONS);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceTestingId, setSourceTestingId] = useState<number | null>(null);
  const [sourceTestResult, setSourceTestResult] = useState<SourceTestResult | null>(null);
  const [runningConfigIds, setRunningConfigIds] = useState<Set<number>>(new Set());
  const [runProgressByConfigId, setRunProgressByConfigId] = useState<RunProgressByConfigId>({});
  const [generatedEmailHtmlByConfigId, setGeneratedEmailHtmlByConfigId] = useState<Record<number, string>>({});

  const emptyConfig = useMemo<ConfigSet>(
    () => ({
      id: 0,
      name: "",
      enabled: 0,
      schedule_cron: FALLBACK_SCHEDULE_OPTIONS[0].cron,
      prompt: "Summarize these items for a daily briefing.",
      source_ids: [],
      recipients_json: "[]",
    }),
    []
  );
  const [configForm, setConfigForm] = useState<ConfigSet>(emptyConfig);
  const [editMode, setEditMode] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const { apiFetch } = useApi(token, handleUnauthorized);
  const { theme, toggleTheme } = useTheme();
  const runningConfigIdsFromRuns = useMemo(() => {
    const ids = new Set<number>();
    const nowMs = Date.now();
    for (const run of runs) {
      if (isRunInProgress(run, nowMs)) {
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

  useEffect(() => {
    const nowMs = Date.now();
    setRunProgressByConfigId((prev) => {
      let changed = false;
      const next: RunProgressByConfigId = { ...prev };

      for (const [configId, latestRun] of latestRunsByConfigId) {
        if (!isRunInProgress(latestRun, nowMs)) {
          if (!runningConfigIds.has(configId) && next[configId]) {
            delete next[configId];
            changed = true;
          }
          continue;
        }

        const messages = getRunStatusMessages(latestRun);
        const previous = next[configId];
        if (!previous || previous.runId !== latestRun.id) {
          next[configId] = { runId: latestRun.id, messages };
          changed = true;
          continue;
        }

        if (!sameMessages(previous.messages, messages)) {
          next[configId] = {
            runId: previous.runId,
            messages,
          };
          changed = true;
        }
      }

      for (const configIdText of Object.keys(next)) {
        const configId = Number(configIdText);
        const latestRun = latestRunsByConfigId.get(configId);

        if (!latestRun && !runningConfigIds.has(configId)) {
          delete next[configId];
          changed = true;
          continue;
        }

        if (latestRun && !isRunInProgress(latestRun, nowMs) && !runningConfigIds.has(configId)) {
          delete next[configId];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [latestRunsByConfigId, runningConfigIds]);

  const withTabLoading = useCallback(
    <T,>(tab: TabId, fn: () => Promise<T>) => async () => {
      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      try {
        return await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load ${tab}`);
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
    void Promise.all([loadSettings(), loadConfigSets(), loadRuns(), loadSources(), loadScheduleOptions()]).catch(
      (err) => setError(err instanceof Error ? err.message : "Failed to load data")
    );
  }, [token]);

  useEffect(() => {
    if (scheduleOptions.length === 0) return;
    setConfigForm((prev) => {
      const normalizedSchedule = normalizeScheduleCronForOptions(prev.schedule_cron, scheduleOptions);
      if (normalizedSchedule === prev.schedule_cron) {
        return prev;
      }
      return { ...prev, schedule_cron: normalizedSchedule };
    });
  }, [scheduleOptions]);

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
        admin_email: data.admin_email ?? "",
        source_items_limit:
          Number.isFinite(data.source_items_limit) && data.source_items_limit > 0 ? data.source_items_limit : 20,
        source_lookback_days: data.source_lookback_days ?? null,
      });
    })();
  }

  async function loadConfigSets() {
    return withTabLoading("configs", async () => {
      const data = (await apiFetch("/api/config-sets")) as ConfigSet[];
      setConfigSets(data);
    })();
  }

  async function loadScheduleOptions() {
    try {
      const data = (await apiFetch("/api/meta/schedules")) as { schedules?: ScheduleOption[] };
      const schedules = Array.isArray(data.schedules)
        ? data.schedules.filter(
            (option): option is ScheduleOption =>
              Boolean(option) &&
              typeof option.cron === "string" &&
              option.cron.length > 0 &&
              typeof option.label === "string" &&
              option.label.length > 0
          )
        : [];
      if (schedules.length > 0) {
        setScheduleOptions(schedules);
      }
    } catch {
      // Keep fallback options when schedule metadata endpoint is unavailable.
    }
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
      const payload = {
        ...configForm,
        schedule_cron: normalizeScheduleCronForOptions(configForm.schedule_cron, scheduleOptions),
      };
      if (payload.schedule_cron !== configForm.schedule_cron) {
        setConfigForm(payload);
      }

      if (payload.id) {
        await apiFetch(`/api/config-sets/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setConfigSets((prev) =>
          prev.map((cs) => (cs.id === payload.id ? { ...payload } : cs))
        );
        setNotice("Config set updated successfully");
      } else {
        await apiFetch("/api/config-sets", {
          method: "POST",
          body: JSON.stringify(payload),
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
    setRunProgressByConfigId((prev) => {
      if (!prev[id]) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
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
    const normalizedSchedule = normalizeScheduleCronForOptions(config.schedule_cron, scheduleOptions);
    setConfigForm({ ...config, schedule_cron: normalizedSchedule });
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
            testingId={sourceTestingId}
            setTestingId={setSourceTestingId}
            testResult={sourceTestResult}
            setTestResult={setSourceTestResult}
          />
        )}

        {activeTab === 'configs' && (
          <ConfigSetList
            configSets={configSets}
            runningConfigIds={activeRunningConfigIds}
            latestRunsByConfigId={latestRunsByConfigId}
            runProgressByConfigId={runProgressByConfigId}
            generatedEmailHtmlByConfigId={generatedEmailHtmlByConfigId}
            configForm={configForm}
            scheduleOptions={scheduleOptions}
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
            sourceItemsLimit={settings.source_items_limit}
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

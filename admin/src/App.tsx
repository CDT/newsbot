import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GlobalSettings as GlobalSettingsType,
  ConfigSet,
  PaginatedRuns,
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

const VALID_TABS: Set<string> = new Set<TabId>(["settings", "sources", "configs", "history"]);
const DEFAULT_TAB: TabId = "configs";

function getTabFromHash(): TabId {
  const hash = window.location.hash.replace(/^#/, "");
  return VALID_TABS.has(hash) ? (hash as TabId) : DEFAULT_TAB;
}

const RUNS_PAGE_SIZE = 20;
type RunProgressByConfigId = Record<number, string[]>;
const FALLBACK_SCHEDULE_OPTIONS: ScheduleOption[] = [
  { cron: "0 23 * * *", label: "Daily at 07:00 UTC+8 (Shanghai)" },
  { cron: "0 2 * * *", label: "Daily at 10:00 UTC+8 (Shanghai)" },
  { cron: "0 6 * * *", label: "Daily at 14:00 UTC+8 (Shanghai)" },
  { cron: "0 10 * * *", label: "Daily at 18:00 UTC+8 (Shanghai)" },
  { cron: "0 13 * * *", label: "Daily at 21:00 UTC+8 (Shanghai)" },
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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromHash);
  const [tabLoading, setTabLoading] = useState<Partial<Record<TabId, boolean>>>({});

  useEffect(() => {
    const newHash = `#${activeTab}`;
    if (window.location.hash !== newHash) {
      window.history.pushState(null, "", newHash);
    }
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [settings, setSettings] = useState<GlobalSettingsType>({
    resend_api_key: "",
    llm_provider: "gemini",
    llm_api_key: "",
    llm_model: null,
    default_sender: "",
    admin_email: "",
    source_items_limit: 20,
    source_lookback_days: null,
    tavily_api_key: "",
  });
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOption[]>(FALLBACK_SCHEDULE_OPTIONS);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotal, setRunsTotal] = useState(0);
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
      use_web_search: 0,
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
    if (!token || runningConfigIds.size === 0) return;

    let cancelled = false;
    const pollRunProgress = async () => {
      try {
        const data = (await apiFetch(`/api/runs?page=1&limit=${RUNS_PAGE_SIZE}`)) as PaginatedRuns;
        if (cancelled) {
          return;
        }

        const latestRunsByConfigId = new Map<number, RunLog>();
        for (const run of data.data) {
          if (!runningConfigIds.has(run.config_set_id) || latestRunsByConfigId.has(run.config_set_id)) {
            continue;
          }
          latestRunsByConfigId.set(run.config_set_id, run);
        }

        setRunProgressByConfigId((prev) => {
          const next: RunProgressByConfigId = {};

          for (const configId of runningConfigIds) {
            const latestRun = latestRunsByConfigId.get(configId);
            if (latestRun) {
              next[configId] = getRunStatusMessages(latestRun);
              continue;
            }

            const previous = prev[configId];
            next[configId] = previous && previous.length > 0 ? previous : ["Starting run..."];
          }

          return next;
        });
      } catch {
        // Ignore progress polling errors during active runs.
      }
    };

    void pollRunProgress();
    const timer = window.setInterval(() => {
      void pollRunProgress();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, apiFetch, runningConfigIds]);

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
        tavily_api_key: data.tavily_api_key ?? "",
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

  async function loadRuns(page?: number) {
    const targetPage = page ?? runsPage;
    return withTabLoading("history", async () => {
      const data = (await apiFetch(
        `/api/runs?page=${targetPage}&limit=${RUNS_PAGE_SIZE}`
      )) as PaginatedRuns;
      setRuns(data.data);
      setRunsTotal(data.total);
      const totalPages = Math.max(1, Math.ceil(data.total / RUNS_PAGE_SIZE));
      if (targetPage > totalPages) {
        setRunsPage(totalPages);
      } else {
        setRunsPage(targetPage);
      }
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
    if (runningConfigIds.has(id)) {
      return;
    }

    setError(null);
    setNotice(null);
    setRunProgressByConfigId((prev) => ({ ...prev, [id]: ["Starting run..."] }));
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
      await loadRuns(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunProgressByConfigId((prev) => {
        if (!prev[id]) {
          return prev;
        }
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
      await loadRuns(1);
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
            runningConfigIds={runningConfigIds}
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
            page={runsPage}
            totalPages={Math.max(1, Math.ceil(runsTotal / RUNS_PAGE_SIZE))}
            totalRuns={runsTotal}
            onPageChange={(p) => loadRuns(p)}
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

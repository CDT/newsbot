import { useEffect, useMemo, useState } from "react";

type GlobalSettings = {
  resend_api_key: string | null;
  gemini_api_key: string | null;
  default_sender: string | null;
};

type ConfigSet = {
  id: number;
  name: string;
  enabled: number;
  schedule_cron: string;
  prompt: string;
  sources_json: string;
  recipients_json: string;
};

type RunLog = {
  id: number;
  config_set_id: number;
  config_name?: string;
  started_at: string;
  status: string;
  item_count: number;
  error_message?: string | null;
  email_id?: string | null;
};

const SESSION_KEY = "newsbot_session";

// Icons as simple SVG components
const Icons = {
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Loader: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
  Mail: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  LogOut: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Inbox: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Layers: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState<GlobalSettings>({
    resend_api_key: "",
    gemini_api_key: "",
    default_sender: "",
  });
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [runs, setRuns] = useState<RunLog[]>([]);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const emptyConfig = useMemo(
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

  // Auto-dismiss notices
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (!token) return;
    void Promise.all([loadSettings(), loadConfigSets(), loadRuns()]);
  }, [token]);

  async function apiFetch(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set("content-type", "application/json");
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Request failed");
    }
    return response.json();
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }
      const data = (await response.json().catch(() => ({}))) as { token?: string };
      const stored = data.token || "";
      if (!stored) {
        throw new Error("Missing session token");
      }
      setToken(stored);
      localStorage.setItem(SESSION_KEY, stored);
      setNotice("Successfully logged in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const data = (await apiFetch("/api/global-settings")) as GlobalSettings;
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

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Login screen
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">📰</div>
            <h1 className="login-title">Newsbot Admin</h1>
            <p className="login-subtitle">Sign in to manage your news digests</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="alert alert-error">
                <span className="alert-icon"><Icons.AlertCircle /></span>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><Icons.Loader /> Signing in...</> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="app-container">
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <div className="app-logo-icon">📰</div>
            <div>
              <h1>Newsbot Admin</h1>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={logout} style={{ color: "rgba(255,255,255,0.8)" }}>
            <Icons.LogOut />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Notifications */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon"><Icons.AlertCircle /></span>
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="alert alert-success">
            <span className="alert-icon"><Icons.Check /></span>
            <span>{notice}</span>
          </div>
        )}

        {/* Global Settings */}
        <section className="card">
          <h2>Global Settings</h2>
          <form onSubmit={saveSettings}>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Resend API Key
                  <span className="label-hint">(for sending emails)</span>
                </label>
                <input
                  type="password"
                  placeholder="re_..."
                  value={settings.resend_api_key ?? ""}
                  onChange={(event) => setSettings({ ...settings, resend_api_key: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  Gemini API Key
                  <span className="label-hint">(for AI summaries)</span>
                </label>
                <input
                  type="password"
                  placeholder="AIza..."
                  value={settings.gemini_api_key ?? ""}
                  onChange={(event) => setSettings({ ...settings, gemini_api_key: event.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Default Sender
                  <span className="label-hint">(email from address)</span>
                </label>
                <input
                  type="text"
                  placeholder="News Digest <digest@yourdomain.com>"
                  value={settings.default_sender ?? ""}
                  onChange={(event) => setSettings({ ...settings, default_sender: event.target.value })}
                />
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <><Icons.Loader /> Saving...</> : <><Icons.Settings /> Save Settings</>}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Config Sets */}
        <section className="card">
          <div className="card-header">
            <h2 style={{ marginBottom: 0 }}>Config Sets</h2>
            {!editMode && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setEditMode(true)}
              >
                + New Config
              </button>
            )}
          </div>

          {/* Config Form */}
          {editMode && (
            <form onSubmit={saveConfigSet} style={{ marginBottom: "24px", padding: "20px", background: "#f8fafc", borderRadius: "12px" }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="Daily Tech Digest"
                    value={configForm.name}
                    onChange={(event) => setConfigForm({ ...configForm, name: event.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Schedule
                    <span className="label-hint">(cron expression)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0 8 * * *"
                    value={configForm.schedule_cron}
                    onChange={(event) => setConfigForm({ ...configForm, schedule_cron: event.target.value })}
                    className="text-mono"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Prompt</label>
                <textarea
                  placeholder="Describe how you want the AI to summarize the news..."
                  value={configForm.prompt}
                  onChange={(event) => setConfigForm({ ...configForm, prompt: event.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Sources
                    <span className="label-hint">(JSON array of RSS/URLs)</span>
                  </label>
                  <textarea
                    className="code"
                    placeholder='["https://example.com/feed.xml"]'
                    value={configForm.sources_json}
                    onChange={(event) => setConfigForm({ ...configForm, sources_json: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>
                    Recipients
                    <span className="label-hint">(JSON array of emails)</span>
                  </label>
                  <textarea
                    className="code"
                    placeholder='["user@example.com"]'
                    value={configForm.recipients_json}
                    onChange={(event) => setConfigForm({ ...configForm, recipients_json: event.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div className="toggle-wrapper">
                  <div
                    className={`toggle ${configForm.enabled ? "active" : ""}`}
                    onClick={() => setConfigForm({ ...configForm, enabled: configForm.enabled ? 0 : 1 })}
                  />
                  <span className="toggle-label">{configForm.enabled ? "Enabled" : "Disabled"}</span>
                </div>

                <div className="btn-group">
                  <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Icons.Loader /> : <Icons.Check />}
                    {configForm.id ? "Update" : "Create"} Config
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Config List */}
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
                <div key={config.id} className="config-card">
                  <div className="config-card-header">
                    <div className="config-card-title">{config.name}</div>
                    <span className={`badge ${config.enabled ? "badge-success" : "badge-default"}`}>
                      <span className="badge-dot" />
                      {config.enabled ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="config-card-meta">
                    <div className="config-card-meta-item">
                      <span className="icon"><Icons.Clock /></span>
                      <code>{config.schedule_cron}</code>
                    </div>
                    <div className="config-card-meta-item">
                      <span className="icon"><Icons.Zap /></span>
                      {JSON.parse(config.sources_json || "[]").length} sources
                    </div>
                    <div className="config-card-meta-item">
                      <span className="icon"><Icons.Mail /></span>
                      {JSON.parse(config.recipients_json || "[]").length} recipients
                    </div>
                  </div>

                  <div className="config-card-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(config)}>
                      <Icons.Edit /> Edit
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => triggerRun(config.id)}>
                      <Icons.Play /> Run Now
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteConfigSet(config.id)}>
                      <Icons.Trash /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Run History */}
        <section className="card">
          <div className="card-header">
            <h2 style={{ marginBottom: 0 }}>Run History</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => loadRuns()}>
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
                <div key={run.id} className="run-item">
                  <div className={`run-item-icon ${run.status === "success" ? "success" : run.status === "error" ? "error" : "running"}`}>
                    {run.status === "success" ? <Icons.Check /> : run.status === "error" ? <Icons.X /> : <Icons.Loader />}
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
                  <span className={`badge ${run.status === "success" ? "badge-success" : run.status === "error" ? "badge-danger" : "badge-primary"}`}>
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

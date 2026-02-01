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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice("Logged in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
    try {
      await apiFetch("/api/global-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setNotice("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function saveConfigSet(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (configForm.id) {
        await apiFetch(`/api/config-sets/${configForm.id}`, {
          method: "PUT",
          body: JSON.stringify(configForm),
        });
        setNotice("Config set updated.");
      } else {
        await apiFetch("/api/config-sets", {
          method: "POST",
          body: JSON.stringify(configForm),
        });
        setNotice("Config set created.");
      }
      setConfigForm(emptyConfig);
      await loadConfigSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config set");
    }
  }

  async function deleteConfigSet(id: number) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/config-sets/${id}`, { method: "DELETE" });
      await loadConfigSets();
      setNotice("Config set deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config set");
    }
  }

  async function triggerRun(id: number) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/run/${id}`, { method: "POST" });
      setNotice("Run started.");
      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run config set");
    }
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(SESSION_KEY);
  }

  if (!token) {
    return (
      <main>
        <section>
          <h1>Newsbot Admin</h1>
          <p>Sign in with the admin credentials stored in Worker secrets.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              required
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">Login</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="inline" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1>Newsbot Admin</h1>
          <p className="badge">Connected</p>
        </div>
        <button className="secondary" onClick={logout}>
          Logout
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <section>
        <h2>Global Settings</h2>
        <form onSubmit={saveSettings} className="grid grid-two">
          <div>
            <label>Resend API Key</label>
            <input
              value={settings.resend_api_key ?? ""}
              onChange={(event) => setSettings({ ...settings, resend_api_key: event.target.value })}
            />
          </div>
          <div>
            <label>Gemini API Key</label>
            <input
              value={settings.gemini_api_key ?? ""}
              onChange={(event) => setSettings({ ...settings, gemini_api_key: event.target.value })}
            />
          </div>
          <div>
            <label>Default Sender</label>
            <input
              placeholder="News Digest <digest@yourdomain.com>"
              value={settings.default_sender ?? ""}
              onChange={(event) => setSettings({ ...settings, default_sender: event.target.value })}
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit">Save Settings</button>
          </div>
        </form>
      </section>

      <section>
        <h2>Config Sets</h2>
        <form onSubmit={saveConfigSet}>
          <div className="grid grid-two">
            <div>
              <label>Name</label>
              <input value={configForm.name} onChange={(event) => setConfigForm({ ...configForm, name: event.target.value })} />
            </div>
            <div>
              <label>Schedule (cron)</label>
              <input
                value={configForm.schedule_cron}
                onChange={(event) => setConfigForm({ ...configForm, schedule_cron: event.target.value })}
              />
            </div>
          </div>
          <label>Prompt</label>
          <textarea value={configForm.prompt} onChange={(event) => setConfigForm({ ...configForm, prompt: event.target.value })} />
          <div className="grid grid-two">
            <div>
              <label>Sources JSON</label>
              <textarea
                value={configForm.sources_json}
                onChange={(event) => setConfigForm({ ...configForm, sources_json: event.target.value })}
              />
            </div>
            <div>
              <label>Recipients JSON</label>
              <textarea
                value={configForm.recipients_json}
                onChange={(event) => setConfigForm({ ...configForm, recipients_json: event.target.value })}
              />
            </div>
          </div>
          <div className="inline">
            <label>Enabled</label>
            <select
              value={String(configForm.enabled)}
              onChange={(event) => setConfigForm({ ...configForm, enabled: Number(event.target.value) })}
            >
              <option value="0">Disabled</option>
              <option value="1">Enabled</option>
            </select>
          </div>
          <div>
            <button type="submit">{configForm.id ? "Update" : "Create"} Config Set</button>
            {configForm.id ? (
              <button type="button" className="secondary" onClick={() => setConfigForm(emptyConfig)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="grid" style={{ marginTop: 16 }}>
          {configSets.map((config) => (
            <section key={config.id}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <h3>{config.name}</h3>
                <span className="badge">{config.enabled ? "Enabled" : "Disabled"}</span>
              </div>
              <p>
                <strong>Cron:</strong> {config.schedule_cron}
              </p>
              <div>
                <button className="secondary" onClick={() => setConfigForm(config)}>
                  Edit
                </button>
                <button className="secondary" onClick={() => triggerRun(config.id)}>
                  Run Now
                </button>
                <button className="danger" onClick={() => deleteConfigSet(config.id)}>
                  Delete
                </button>
              </div>
            </section>
          ))}
        </div>
      </section>

      <section>
        <h2>Run History</h2>
        <div className="grid">
          {runs.map((run) => (
            <div key={run.id}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <strong>{run.config_name || `Config ${run.config_set_id}`}</strong>
                <span className="badge">{run.status}</span>
              </div>
              <p>
                {new Date(run.started_at).toLocaleString()} · {run.item_count} items
              </p>
              {run.error_message && <p className="error">{run.error_message}</p>}
              {run.email_id && <p>Email: {run.email_id}</p>}
            </div>
          ))}
          {runs.length === 0 && <p>No runs yet.</p>}
        </div>
      </section>
    </main>
  );
}

export default App;

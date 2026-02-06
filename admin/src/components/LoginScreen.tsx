import { useState } from "react";
import { Icons } from "../Icons";
import { Alert } from "./Alert";
import { SESSION_KEY } from "../utils";

type LoginScreenProps = {
  onLogin: (token: string) => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const token = data.token || "";
      if (!token) {
        throw new Error("Missing session token");
      }
      localStorage.setItem(SESSION_KEY, token);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">📰</div>
          <h1 className="login-title">Newsbot Admin</h1>
          <p className="login-subtitle">Sign in to manage your news digests</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <Alert type="error" message={error} />}

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

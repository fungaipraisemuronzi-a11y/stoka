import { useState } from "react";
import "./App.css";
import Dashboard from "./Dashboard.jsx";

const API_URL = "http://localhost:5000";

function getSavedAdmin() {
  const token = sessionStorage.getItem("stoka_admin_token");
  const user = sessionStorage.getItem("stoka_admin_user");

  if (!token || !user) return null;

  try {
    return JSON.parse(user);
  } catch {
    sessionStorage.removeItem("stoka_admin_token");
    sessionStorage.removeItem("stoka_admin_user");
    return null;
  }
}

export default function App() {
  const [admin, setAdmin] = useState(getSavedAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function logout() {
    sessionStorage.removeItem("stoka_admin_token");
    sessionStorage.removeItem("stoka_admin_user");
    setAdmin(null);
    setPassword("");
    setUsername("");
    setError("");
    window.history.replaceState({}, "", "/");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your admin username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to log in.");
      }

      if (!data.token || !data.admin) {
        throw new Error("The server returned an invalid admin session.");
      }

      sessionStorage.setItem("stoka_admin_token", data.token);
      sessionStorage.setItem(
        "stoka_admin_user",
        JSON.stringify(data.admin)
      );

      setAdmin(data.admin);
      setPassword("");
      window.history.replaceState({}, "", "/dashboard");
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the backend. Check that the server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  if (admin) {
    return <Dashboard onLogout={logout} />;
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-icon">S</div>

        <h1>Stoka Admin</h1>
        <p className="subtitle">Administration portal</p>

        <div className="login-divider" />

        <h2>Welcome back</h2>
        <p className="description">
          Sign in to manage businesses and review feedback.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="username">Admin username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="security-note">
          Authorized administrators only
        </p>
      </section>

      <footer>Stoka Stock Management System</footer>
    </main>
  );
}
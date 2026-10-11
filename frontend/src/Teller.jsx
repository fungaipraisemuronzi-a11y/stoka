
import { useState } from "react";
import "./Teller.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function Teller({ business, onBack, onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setName("");
    setPassword("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const endpoint =
        mode === "create"
          ? "/api/tellers/create"
          : "/api/tellers/login";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business.id,
          name: name.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      if (mode === "create") {
        setMessage("Teller created successfully. You can now log in.");
        setMode("login");
        setPassword("");
      } else {
        localStorage.setItem(
          "stoka_teller",
          JSON.stringify(data.teller)
        );

        onLogin(data.teller);
      }
    } catch (error) {
      setMessage(error.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="teller-auth-page">
      <section className="teller-auth-card">
        <button
          type="button"
          className="teller-back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="teller-brand">
          <div className="teller-brand-icon">S</div>
          <h1>Stoka</h1>
          <p>Teller access</p>
        </div>

        <div className="teller-heading">
          <h2>
            {mode === "login" ? "Teller Login" : "Create Teller"}
          </h2>
          <p>
            Business: {business.businessName || business.id}
          </p>
        </div>

        <div className="teller-mode-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "create" ? "active" : ""}
            onClick={() => changeMode("create")}
          >
            New Teller
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="tellerName">Teller name</label>
          <input
            id="tellerName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter teller name"
            autoComplete="username"
            maxLength={100}
            required
          />

          <label htmlFor="tellerPassword">Password</label>
          <input
            id="tellerPassword"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter teller password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
          />

          <button
            type="submit"
            className="teller-submit-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login as Teller"
                : "Create Teller"}
          </button>
        </form>

        {message && (
          <p className="teller-message" role="alert">
            {message}
          </p>
        )}

        <p className="teller-footer">
          Each teller has a separate workspace.
        </p>
      </section>
    </main>
  );
}

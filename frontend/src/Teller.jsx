
import { useState } from "react";
import "./Teller.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function Teller({ business, onBack, onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setName("");
    setPassword("");
    setMessage("");
    setMessageType("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!business?.id) {
      setMessage("Business information is missing. Please log in again.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

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
        setMessage(
          data.message ||
            "Your registration request has been submitted. Please wait for the Primary Manager to approve your account."
        );

        setMessageType("success");
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
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="teller-auth-page">
      <section className="teller-auth-card">
        <div className="teller-mode-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
            disabled={loading}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "create" ? "active" : ""}
            onClick={() => changeMode("create")}
            disabled={loading}
          >
            New Teller
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="tellerName">Teller username</label>

          <input
            id="tellerName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter teller username"
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
            minLength={mode === "create" ? 4 : undefined}
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
                : "Submit Approval Request"}
          </button>
        </form>

        {message && (
          <p
            className={`teller-message ${messageType}`}
            role="alert"
          >
            {message}
          </p>
        )}

        <button
          type="button"
          className="teller-back-button"
          onClick={onBack}
          disabled={loading}
        >
          Back
        </button>
      </section>
    </main>
  );
}

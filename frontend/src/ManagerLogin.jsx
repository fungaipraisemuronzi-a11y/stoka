
import { useCallback, useEffect, useState } from "react";

import "./Stock.css";
import "./ManagerLogin.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function ManagerLogin({ business, onBack, onLogin }) {
  const [hasManagers, setHasManagers] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState("login");

  const [managerUsername, setManagerUsername] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessUsername, setBusinessUsername] = useState(
    business?.username || ""
  );
  const [businessPassword, setBusinessPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const businessId = business?.id;

  const checkManagerStatus = useCallback(async () => {
    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      setCheckingStatus(false);
      return;
    }

    setCheckingStatus(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/manager-passwords/status?businessId=${encodeURIComponent(
          businessId
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not check manager accounts.");
      }

      const exists = Boolean(data.exists);

      setHasManagers(exists);
      setMode(exists ? "login" : "setup");
    } catch (err) {
      setHasManagers(null);
      setError(err.message || "Could not connect to the server.");
    } finally {
      setCheckingStatus(false);
    }
  }, [businessId]);

  useEffect(() => {
    checkManagerStatus();
  }, [checkManagerStatus]);

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!managerUsername.trim()) {
      setError("Please enter a manager username.");
      return;
    }

    if (!managerPassword) {
      setError("Please enter a manager password.");
      return;
    }

    if (managerPassword.length < 6) {
      setError("Manager password must contain at least 6 characters.");
      return;
    }

    if (mode !== "login") {
      if (managerPassword !== confirmPassword) {
        setError("Manager passwords do not match.");
        return;
      }

      if (!businessUsername.trim() || !businessPassword) {
        setError("Enter the business username and business password.");
        return;
      }
    }

    const endpoint =
      mode === "setup"
        ? "setup"
        : mode === "register"
          ? "register"
          : "login";

    const payload = {
      businessId,
      username: managerUsername.trim(),
      password: managerPassword,
    };

    if (mode !== "login") {
      payload.businessUsername = businessUsername.trim();
      payload.businessPassword = businessPassword;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/manager-passwords/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Manager access failed.");
      }

      if (mode === "register") {
        setMessage(
          data.message ||
            "Registration submitted. The Primary Manager must approve your account."
        );

        setManagerPassword("");
        setConfirmPassword("");
        setBusinessPassword("");
        setManagerUsername("");

        return;
      }

      if (mode === "setup" || mode === "login") {
        if (!data.token || !data.manager) {
          throw new Error("The server did not return a valid manager session.");
        }

        setMessage(data.message || "Manager login successful.");

        setManagerPassword("");
        setConfirmPassword("");
        setBusinessPassword("");

        if (typeof onLogin === "function") {
          onLogin({
            token: data.token,
            manager: data.manager,
          });
        }
      }
    } catch (err) {
      setError(err.message || "Manager access failed.");
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode) => {
    resetMessages();
    setManagerPassword("");
    setConfirmPassword("");

    if (nextMode === "setup" || nextMode === "register") {
      setBusinessPassword("");
    }

    setMode(nextMode);
  };

  const title =
    mode === "setup"
      ? "Set Up Primary Manager"
      : mode === "register"
        ? "Register Another Manager"
        : "Manager Login";

  const description =
    mode === "setup"
      ? "Create the first manager account for this business."
      : mode === "register"
        ? "Submit a manager registration for approval."
        : "Sign in to your manager account";

  if (checkingStatus) {
    return (
      <main className="stoka-manager-page">
        <section className="card manager-auth-card">
          <div className="manager-auth-heading">
            <p>Loading manager accounts. Please wait...</p>
          </div>
        </section>
      </main>
    );
  }

  if (hasManagers === null) {
    return (
      <main className="stoka-manager-page">
        <section className="card manager-auth-card">
          <div className="manager-auth-heading">
            <h2>Manager Access</h2>
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="primary-button"
            onClick={checkManagerStatus}
          >
            Try Again
          </button>

          <button
            type="button"
            className="manager-home-button"
            onClick={onBack}
          >
            Back to Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="stoka-manager-page">
      <section className="card manager-auth-card">
        <div className="manager-auth-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode !== "login" && (
            <>
              <div className="form-group">
                <label htmlFor="business-username">
                  Business username
                </label>

                <input
                  id="business-username"
                  type="text"
                  value={businessUsername}
                  onChange={(event) =>
                    setBusinessUsername(event.target.value)
                  }
                  placeholder="Enter business username"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="business-password">
                  Business password
                </label>

                <input
                  id="business-password"
                  type="password"
                  value={businessPassword}
                  onChange={(event) =>
                    setBusinessPassword(event.target.value)
                  }
                  placeholder="Enter business password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="manager-username">
              Manager username
            </label>

            <input
              id="manager-username"
              type="text"
              value={managerUsername}
              onChange={(event) =>
                setManagerUsername(event.target.value)
              }
              placeholder={
                mode === "login"
                  ? "Enter your manager username"
                  : "Create a manager username"
              }
              autoComplete="username"
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9]+"
              title="Use 3–50 letters or numbers only."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="manager-password">
              Manager password
            </label>

            <input
              id="manager-password"
              type="password"
              value={managerPassword}
              onChange={(event) =>
                setManagerPassword(event.target.value)
              }
              placeholder="At least 6 characters"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={6}
              required
            />
          </div>

          {mode !== "login" && (
            <div className="form-group">
              <label htmlFor="confirm-manager-password">
                Confirm manager password
              </label>

              <input
                id="confirm-manager-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Re-enter manager password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="primary-button manager-unlock-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "setup"
                ? "Create Primary Manager"
                : mode === "register"
                  ? "Submit Registration"
                  : "Log In"}
          </button>
        </form>

        {hasManagers && mode === "login" && (
          <button
            type="button"
            className="manager-home-button"
            onClick={() => changeMode("register")}
          >
            Register Another Manager
          </button>
        )}

        {mode === "register" && (
          <button
            type="button"
            className="manager-home-button"
            onClick={() => changeMode("login")}
          >
            Back to Manager Login
          </button>
        )}

        <button
          type="button"
          className="manager-home-button"
          onClick={onBack}
        >
          Back to Home
        </button>
      </section>
    </main>
  );
}

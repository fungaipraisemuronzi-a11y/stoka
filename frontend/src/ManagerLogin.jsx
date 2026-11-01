import { useCallback, useEffect, useState } from "react";
import "./Stock.css";
import "./ManagerLogin.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function ManagerLogin({ business, onBack, onLogin }) {
const [hasPassword, setHasPassword] = useState(null);
const [checkingPassword, setCheckingPassword] = useState(true);
const [loading, setLoading] = useState(false);
const [managerPassword, setManagerPassword] = useState("");
const [enteredPassword, setEnteredPassword] = useState("");
const [error, setError] = useState("");
const [message, setMessage] = useState("");

const businessId = business?.id;

const checkPasswordStatus = useCallback(async () => {
if (businessId === undefined || businessId === null) {
setError("Business information is missing. Please log in again.");
setCheckingPassword(false);
return;
}

setCheckingPassword(true);
setError("");

try {
  const response = await fetch(
    `${API_URL}/api/manager-passwords/status?businessId=${encodeURIComponent(
      businessId
    )}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not check manager password.");
  }

  setHasPassword(Boolean(data.exists));
} catch (err) {
  setHasPassword(null);
  setError(err.message || "Could not connect to the server.");
} finally {
  setCheckingPassword(false);
}

}, [businessId]);

useEffect(() => {
checkPasswordStatus();
}, [checkPasswordStatus]);

const handleManagerAccess = async (event) => {
event.preventDefault();
setError("");
setMessage("");

const password = hasPassword ? enteredPassword : managerPassword;

if (!password) {
  setError("Please enter a manager password.");
  return;
}

if (!hasPassword && password.length < 4) {
  setError("Password must contain at least 4 characters.");
  return;
}

setLoading(true);

try {
  const endpoint = hasPassword ? "login" : "create";

  const response = await fetch(
    `${API_URL}/api/manager-passwords/${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId,
        password,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Manager access failed.");
  }

  setMessage(
    hasPassword
      ? "Manager login successful."
      : "Manager password created successfully."
  );

  setManagerPassword("");
  setEnteredPassword("");

  if (typeof onLogin === "function") {
    onLogin();
  }
} catch (err) {
  setError(err.message || "Manager access failed.");
} finally {
  setLoading(false);
}

};

return (
<main className="stoka-manager-page">


  <section className="card manager-auth-card">
    {checkingPassword ? (
      <div className="manager-auth-heading">
       
       
        <p>Loading. please wait...</p>
      </div>
    ) : hasPassword === null ? (
      <>
      

        <p className="error-message" role="alert">
          {error || "Unexpected error"}
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={checkPasswordStatus}
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
      </>
    ) : (
      <>
        <div className="manager-auth-heading">
          

          

          <p>
            {hasPassword
              ? "Enter your password to continue."
              : "Create a password to protect your manager workspace."}
          </p>
        </div>

        <form onSubmit={handleManagerAccess}>
          <div className="form-group">
            <label htmlFor="manager-password">
              {hasPassword
                ? "Manager password"
                : "Create manager password"}
            </label>

            <input
              id="manager-password"
              type="password"
              value={hasPassword ? enteredPassword : managerPassword}
              onChange={(event) =>
                hasPassword
                  ? setEnteredPassword(event.target.value)
                  : setManagerPassword(event.target.value)
              }
              placeholder={
                hasPassword
                  ? "Enter your password"
                  : "At least 4 characters"
              }
              autoComplete={
                hasPassword ? "current-password" : "new-password"
              }
              minLength={hasPassword ? undefined : 4}
              required
            />
          </div>

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
              : hasPassword
                ? "Log In"
                : "Create Password"}
          </button>
        </form>

        <button
          type="button"
          className="manager-home-button"
          onClick={onBack}
        >
          Back to Home
        </button>
      </>
    )}
  </section>
</main>

);
}
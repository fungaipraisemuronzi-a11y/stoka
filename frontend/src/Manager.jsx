
import { useCallback, useEffect, useState } from "react";
import Stock from "./Stock";
import IE from "./IE";
import TellerHistory from "./TellerHistory";
import Reports from "./Reports";
import "./App.css";
import "./Stock.css";

const API_URL = "http://localhost:5000";
const WHATSAPP_NUMBER = "263777847204";
const SUBSCRIBE_CODE = "*151*1*1*0777847204*6#";

const tabs = [
  {
    id: "Stock",
    label: "Stock",
    icon: "📦",
    description: "Manage products and stock.",
  },
  {
    id: "I&E",
    label: "Income & Expenses",
    icon: "💰",
    description: "Track business income and expenses.",
  },
  {
    id: "Tellers",
    label: "Tellers",
    icon: "👥",
    description: "Manage teller workspaces.",
  },
  {
    id: "Reports",
    label: "Reports",
    icon: "📊",
    description: "Review business performance.",
  },
];

export default function Manager({ business, onBack }) {
  const [hasPassword, setHasPassword] = useState(null);
  const [checkingPassword, setCheckingPassword] = useState(true);
  const [loading, setLoading] = useState(false);

  const [managerPassword, setManagerPassword] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");

  // These fields now change the BUSINESS account password.
  const [currentManagerPassword, setCurrentManagerPassword] =
    useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("Stock");
  const [showSettings, setShowSettings] = useState(false);

  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const businessId = business?.id;

  const businessName =
    business?.businessName ||
    business?.business_name ||
    business?.name ||
    "Business";

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json();
      return data.message || "Something went wrong.";
    } catch {
      return "Something went wrong. Please try again.";
    }
  };

  // Keep the existing manager-workspace password check.
  const checkPasswordStatus = useCallback(async () => {
    if (businessId === undefined || businessId === null) {
      setError(
        "Business information is missing. Please return and log in again."
      );
      setCheckingPassword(false);
      return;
    }

    setCheckingPassword(true);
    clearMessages();

    try {
      const response = await fetch(
        `${API_URL}/api/manager-passwords/status?businessId=${encodeURIComponent(
          businessId
        )}`
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();
      setHasPassword(Boolean(data.exists));
    } catch (err) {
      setHasPassword(null);
      setError(
        err.message ||
          "Could not connect to the server. Check that your backend is running."
      );
    } finally {
      setCheckingPassword(false);
    }
  }, [businessId]);

  useEffect(() => {
    checkPasswordStatus();
  }, [checkPasswordStatus]);

  const handleManagerAccess = async (event) => {
    event.preventDefault();
    clearMessages();

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not verify manager password."
        );
      }

      setHasPassword(true);
      setUnlocked(true);
      setActiveTab("Stock");
      setManagerPassword("");
      setEnteredPassword("");
      setShowSettings(false);

      setMessage(
        hasPassword
          ? "Manager login successful."
          : "Manager password created successfully."
      );
    } catch (err) {
      setError(err.message || "Manager access failed.");
    } finally {
      setLoading(false);
    }
  };

  // Change the business password in the Business table.
  const handleChangePassword = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!businessId) {
      setError(
        "Business information is missing. Please log in again."
      );
      return;
    }

    if (
      !currentManagerPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword.length > 15) {
      setError("New password cannot exceed 15 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentManagerPassword === newPassword) {
      setError(
        "The new password must differ from the current password."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: String(businessId),
            currentPassword: currentManagerPassword,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not change business password."
        );
      }

      setCurrentManagerPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage(
        data.message || "Business account password changed successfully."
      );
    } catch (err) {
      setError(
        err.message || "Could not change business password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    clearMessages();

    const trimmedFeedback = feedbackText.trim();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!trimmedFeedback) {
      setError("Please enter your feedback before submitting.");
      return;
    }

    setSubmittingFeedback(true);

    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId,
          message: trimmedFeedback,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not submit feedback.");
      }

      setFeedbackText("");
      setMessage(
        data.message || "Thank you. Your feedback has been submitted."
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not submit feedback. Please check your internet connection and try again."
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleLockManager = () => {
    setUnlocked(false);
    setShowSettings(false);
    setCurrentManagerPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEnteredPassword("");
    setManagerPassword("");
    setFeedbackText("");
    setActiveTab("Stock");
    clearMessages();
    checkPasswordStatus();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowSettings(false);
    clearMessages();
  };

  const handleSettingsClick = () => {
    setShowSettings((previous) => !previous);
    clearMessages();
  };

  if (checkingPassword) {
    return (
      <main className="app-container auth-background">
        <section className="card manager-status-card">
          <div className="manager-logo">S</div>
          <h2>Stoka Manager</h2>
          <p>Checking manager password...</p>
        </section>
      </main>
    );
  }

  if (hasPassword === null) {
    return (
      <main className="app-container auth-background">
        <section className="card manager-status-card">
          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            ← Back
          </button>

          <div className="manager-logo">S</div>
          <h2>Unable to connect</h2>

          <p className="error-message">
            {error || "Could not check manager password status."}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={checkPasswordStatus}
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="app-container auth-background">
        <section className="card manager-auth-card">
          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            ← Back to Home
          </button>

          <div className="manager-logo">S</div>

          <p className="manager-eyebrow">SECURE WORKSPACE</p>
          <h1 className="manager-auth-title">Stoka Manager</h1>
          <p className="manager-business-name">{businessName}</p>

          <div className="manager-auth-divider" />

          <h2 className="manager-auth-subtitle">
            {hasPassword
              ? "Welcome back"
              : "Set up your manager access"}
          </h2>

          <p className="manager-auth-description">
            {hasPassword
              ? "Enter your manager password to continue."
              : "Create a password to protect your management workspace."}
          </p>

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
                value={
                  hasPassword ? enteredPassword : managerPassword
                }
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
                  ? "Unlock Manager →"
                  : "Create Password →"}
            </button>
          </form>

          <p className="manager-security-note">
            Your management workspace is protected by your manager password.
          </p>
        </section>
      </main>
    );
  }

  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <main className="manager-dashboard">
      <header className="manager-header">
        <div className="manager-header-brand">
          <div className="manager-logo manager-logo-small">S</div>
          <div>
            <strong>Stoka</strong>
            <span>MANAGER WORKSPACE</span>
          </div>
        </div>

        <div className="manager-header-actions">
          <button
            type="button"
            className="manager-header-button"
            onClick={onBack}
          >
            ← Home
          </button>

          <button
            type="button"
            className="manager-header-button"
            onClick={handleSettingsClick}
            aria-pressed={showSettings}
          >
            ⚙ {showSettings ? "Workspace" : "Settings"}
          </button>

          <button
            type="button"
            className="manager-lock-button"
            onClick={handleLockManager}
          >
            <span aria-hidden="true">🔒</span> Lock
          </button>
        </div>
      </header>

      <section className="manager-hero">
        <div className="manager-hero-content">
          <p className="manager-eyebrow manager-eyebrow-light">
            {showSettings
              ? "MANAGER PREFERENCES"
              : "MANAGEMENT OVERVIEW"}
          </p>

          <h1>{showSettings ? "Settings" : "Manager Dashboard"}</h1>
          <p className="manager-hero-business">{businessName}</p>

          <p className="manager-hero-description">
            {showSettings
              ? "Change your business password, contact Stoka support, send feedback and subscribe."
              : "Manage your stock, finances, tellers and business reports."}
          </p>
        </div>

        <div className="manager-hero-mark" aria-hidden="true">
          S
        </div>
      </section>

      {message && (
        <p className="success-message manager-feedback" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="error-message manager-feedback" role="alert">
          {error}
        </p>
      )}

      {showSettings ? (
        <section className="manager-selected-section">
          <div className="manager-selected-heading">
            <div className="manager-selected-icon" aria-hidden="true">
              ⚙️
            </div>
            <div>
              <p className="manager-eyebrow">SETTINGS</p>
              <h2>Business settings</h2>
              <p>Manage your business account and Stoka support.</p>
            </div>
          </div>

          <div className="manager-content manager-settings-grid">
            <section className="card manager-password-card">
              <div className="manager-panel-heading">
                <div className="manager-panel-icon">🔐</div>
                <div>
                  <h3>Change business password</h3>
                  <p>
                    Change the password used to log in to your Stoka business
                    account. This is not your separate manager workspace
                    password.
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleChangePassword}
                className="manager-password-form"
              >
                <div className="form-group">
                  <label htmlFor="current-business-password">
                    Current business password
                  </label>
                  <input
                    id="current-business-password"
                    type="password"
                    value={currentManagerPassword}
                    onChange={(event) =>
                      setCurrentManagerPassword(event.target.value)
                    }
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-business-password">
                    New business password
                  </label>
                  <input
                    id="new-business-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    maxLength={15}
                    required
                  />
                  <small>Maximum 15 characters.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-business-password">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-business-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    maxLength={15}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Change business password"}
                </button>
              </form>
            </section>

            <section className="card manager-password-card">
              <div className="manager-panel-heading">
                <div className="manager-panel-icon">💬</div>
                <div>
                  <h3>Submit feedback</h3>
                  <p>
                    Send a suggestion, report a problem or tell us how to
                    improve Stoka.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitFeedback}>
                <div className="form-group">
                  <label htmlFor="manager-feedback-message">
                    Your feedback
                  </label>
                  <textarea
                    id="manager-feedback-message"
                    value={feedbackText}
                    onChange={(event) =>
                      setFeedbackText(event.target.value)
                    }
                    placeholder="Write your feedback here..."
                    rows={5}
                    maxLength={3000}
                    required
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                  <small>{feedbackText.length}/3000 characters</small>
                </div>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submittingFeedback}
                >
                  {submittingFeedback
                    ? "Submitting..."
                    : "Send feedback"}
                </button>
              </form>
            </section>

            <section className="card manager-password-card">
              <div className="manager-panel-heading">
                <div className="manager-panel-icon">📱</div>
                <div>
                  <h3>Contact Stoka</h3>
                  <p>Need assistance? Contact us on WhatsApp.</p>
                </div>
              </div>

              <p>
                <strong>WhatsApp:</strong> 0777847204
              </p>

              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  "Hello Stoka support, I need assistance."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="primary-button"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                Open WhatsApp
              </a>
            </section>

            <section className="card manager-password-card">
              <div className="manager-panel-heading">
                <div className="manager-panel-icon">⭐</div>
                <div>
                  <h3>Subscribe to Stoka</h3>
                  <p>
                    Start the subscription process using your phone.
                  </p>
                </div>
              </div>

              <p>
                Subscription activation is handled manually. After following
                the phone prompts, please contact Stoka if you need help
                confirming your subscription.
              </p>

              <p>
                <strong>USSD code:</strong> {SUBSCRIBE_CODE}
              </p>

              <a
                href={`tel:${SUBSCRIBE_CODE}`}
                className="primary-button"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                ☎ Subscribe
              </a>

              <p className="manager-security-note">
                This button opens your phone's dialer where supported. It
                does not automatically activate or confirm a subscription.
              </p>
            </section>
          </div>

          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              className="manager-header-button"
              onClick={handleSettingsClick}
            >
              ← Back to Workspace
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="manager-dashboard-tools">
            <div className="manager-section-intro">
              <h2>Workspace</h2>
              <p>Select a section to manage your business.</p>
            </div>

            <button
              type="button"
              className="manager-password-button"
              onClick={handleSettingsClick}
            >
              <span aria-hidden="true">⚙</span>
              Settings
            </button>
          </section>

          <nav className="manager-tabs" aria-label="Manager navigation">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  activeTab === tab.id
                    ? "manager-tab active"
                    : "manager-tab"
                }
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="manager-tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="manager-tab-label">{tab.label}</span>
                <span className="manager-tab-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </nav>

          <section className="manager-selected-section">
            <div className="manager-selected-heading">
              <div className="manager-selected-icon" aria-hidden="true">
                {active.icon}
              </div>
              <div>
                <p className="manager-eyebrow">CURRENT SECTION</p>
                <h2>{active.label}</h2>
                <p>{active.description}</p>
              </div>
            </div>

            <div className="manager-content">
              {activeTab === "Stock" && <Stock business={business} />}
              {activeTab === "I&E" && <IE business={business} />}
              {activeTab === "Tellers" && (
                <TellerHistory businessId={businessId} />
              )}
              {activeTab === "Reports" && (
                <Reports business={business} businessId={businessId} />
              )}
            </div>
          </section>
        </>
      )}

      <footer className="manager-footer">
        <span>Stoka Management</span>
        <span>{businessName}</span>
      </footer>
    </main>
  );
}

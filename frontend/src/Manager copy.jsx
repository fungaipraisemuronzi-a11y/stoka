import { useState } from "react";
import Stock from "./Stock";
import IE from "./IE";
import "./App.css";
import "./Stock.css";

const tabs = [
  { name: "Stock", icon: "📦", description: "Set up products and selling prices." },
  { name: "I&E", icon: "📊", description: "Manage income and expenses." },
  { name: "Tellers", icon: "👥", description: "Manage teller workspaces." },
  { name: "Reports", icon: "📈", description: "Review business performance." },
];

export default function Manager({ business, onBack }) {
  const passwordKey = `stoka_manager_password_${business.id}`;

  const [managerPassword, setManagerPassword] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("Stock");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);

  const savedPassword = localStorage.getItem(passwordKey);

  function handleManagerAccess(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!savedPassword) {
      if (!managerPassword.trim()) {
        setError("Please create a manager password.");
        return;
      }
      localStorage.setItem(passwordKey, managerPassword);
      setUnlocked(true);
      setManagerPassword("");
      setMessage("Manager password created successfully.");
      return;
    }

    if (enteredPassword !== savedPassword) {
      setError("Incorrect manager password.");
      return;
    }

    setUnlocked(true);
    setEnteredPassword("");
    setMessage("");
  }

  function handleChangePassword(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!newPassword.trim()) {
      setError("Enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    localStorage.setItem(passwordKey, newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setShowChangePassword(false);
    setMessage("Manager password changed successfully.");
  }

  function lockManager() {
    setUnlocked(false);
    setEnteredPassword("");
    setManagerPassword("");
    setMessage("");
    setError("");
    setShowChangePassword(false);
  }

  if (!unlocked) {
    return (
      <main className="app-container auth-background">
        <section className="auth-card manager-auth-card">
          <button type="button" className="back-button manager-back" onClick={onBack}>
            ← Back to Home
          </button>
          <div className="brand manager-brand">
            <div className="brand-icon">S</div>
            <h1>Stoka Manager</h1>
            <p>{business.businessName}</p>
          </div>
          <div className="auth-heading">
            <h2>{savedPassword ? "Manager login" : "Create manager password"}</h2>
            <p>
              {savedPassword
                ? "Enter your manager password to continue."
                : "Set a password to protect the manager workspace on this device."}
            </p>
          </div>
          <form onSubmit={handleManagerAccess}>
            <label htmlFor="managerPassword">
              {savedPassword ? "Manager password" : "Create password"}
            </label>
            <input
              id="managerPassword"
              type="password"
              value={savedPassword ? enteredPassword : managerPassword}
              onChange={(event) => {
                if (savedPassword) setEnteredPassword(event.target.value);
                else setManagerPassword(event.target.value);
              }}
              placeholder={savedPassword ? "Enter manager password" : "Create manager password"}
              autoComplete="current-password"
              required
            />
            <button className="submit-button" type="submit">
              {savedPassword ? "Unlock Manager" : "Create Password"}
            </button>
          </form>
          {message && <p className="message" role="status">{message}</p>}
          {error && <p className="message" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  const active = tabs.find((tab) => tab.name === activeTab) || tabs[0];

  return (
    <main className="manager-dashboard">
      <header className="manager-header">
        <button type="button" className="back-button" onClick={onBack}>← Back to Home</button>
        <div className="small-brand">
          <span className="brand-icon small-icon">S</span>
          <div>
            <strong>Stoka Manager</strong>
            <span className="brand-subtitle">MANAGEMENT WORKSPACE</span>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={lockManager}>Lock Manager</button>
      </header>

      <section className="manager-welcome">
        <div>
          <p className="eyebrow light-eyebrow">MANAGER WORKSPACE</p>
          <h1>{business.businessName}</h1>
          <p>Manage your stock, finances, tellers and reports.</p>
        </div>
        <button
          type="button"
          className="manager-password-button"
          onClick={() => {
            setShowChangePassword((current) => !current);
            setMessage("");
            setError("");
          }}
        >
          {showChangePassword ? "Cancel password change" : "Change password"}
        </button>
      </section>

      {showChangePassword && (
        <section className="manager-content manager-password-panel">
          <h2>Change manager password</h2>
          <form onSubmit={handleChangePassword} className="manager-password-form">
            <div>
              <label htmlFor="newManagerPassword">New password</label>
              <input
                id="newManagerPassword"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmManagerPassword">Confirm new password</label>
              <input
                id="confirmManagerPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button className="stock-save-button" type="submit">Save new password</button>
          </form>
        </section>
      )}

      {message && <p className="manager-notice" role="status">{message}</p>}
      {error && <p className="stock-error" role="alert">{error}</p>}

      <nav className="manager-tabs" aria-label="Manager sections">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.name}
            className={`manager-tab ${activeTab === tab.name ? "active" : ""}`}
            onClick={() => setActiveTab(tab.name)}
          >
            <span>{tab.icon}</span>
            {tab.name}
          </button>
        ))}
      </nav>

      {activeTab === "Stock" ? (
        <section className="manager-content"><Stock business={business} /></section>
      ) : activeTab === "I&E" ? (
        <section className="manager-content"><IE business={business} /></section>
      ) : (
        <section className="manager-content">
          <div className="manager-content-heading">
            <div className="manager-content-icon">{active.icon}</div>
            <div>
              <p className="eyebrow">MANAGER SECTION</p>
              <h2>{active.name}</h2>
              <p>{active.description}</p>
            </div>
          </div>
          <div className="manager-empty-state">
            <div className="empty-state-icon">{active.icon}</div>
            <h3>{active.name} workspace</h3>
            <p>This section will be connected to the database in its next development stage.</p>
          </div>
        </section>
      )}
    </main>
  );
}

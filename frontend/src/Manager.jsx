
import { useState } from "react";
import Stock from "./Stock";
import AddStock from "./AddStock";
import IE from "./IE";
import TellerHistory from "./TellerHistory";
import Reports from "./Reports";
import ManagerLogin from "./ManagerLogin";
import "./Stock.css";
import "./Manager.css";


const API_URL = "https://stoka-of78.onrender.com";
const WHATSAPP_NUMBER = "263777847204";
const SUBSCRIBE_CODE = "*151*1*1*0777847204*6#";

const menuItems = [
  { id: "Stock", label: "Stock Setup" },
  { id: "Purchases", label: "Purchases", icon: "🛒" },
  { id: "IE", label: "Income and Expenses", icon: "🧾" },
  { id: "Tellers", label: "Tellers", icon: "👥" },
  { id: "Reports", label: "Reports", icon: "📊" },
];

export default function Manager({ business, onBack }) {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("Stock");
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [currentManagerPassword, setCurrentManagerPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const getResponseData = async (response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    clearMessages();

    if (businessId === undefined || businessId === null) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!currentManagerPassword || !newPassword || !confirmPassword) {
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
      setError("The new password must differ from the current password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: String(businessId),
          currentPassword: currentManagerPassword,
          newPassword,
        }),
      });

      const data = await getResponseData(response);

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
      setError(err.message || "Could not change business password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    clearMessages();

    const trimmedFeedback = feedbackText.trim();

    if (businessId === undefined || businessId === null) {
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

      const data = await getResponseData(response);

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

  const handleLogout = () => {
    setUnlocked(false);
    setActiveTab("Stock");
    setShowSettings(false);
    setMenuOpen(false);

    setCurrentManagerPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFeedbackText("");

    setLoading(false);
    setSubmittingFeedback(false);
    clearMessages();
  };

  const handleMenuSelect = (itemId) => {
    setMenuOpen(false);
    clearMessages();

    if (itemId === "Logout") {
      handleLogout();
      return;
    }

    if (itemId === "More") {
      setShowSettings(true);
      return;
    }

    setShowSettings(false);
    setActiveTab(itemId);
  };

  const handleHomeClick = () => {
    setMenuOpen(false);
    onBack?.();
  };

  const renderHeader = () => (
    <header className="stoka-manager-header">
      <div className="stoka-manager-brand">
        <span className="stoka-manager-brand-name">Stoka</span>
      </div>

      <div className="stoka-manager-business">
        <strong>{businessName}</strong>
      </div>

      <div className="stoka-manager-menu-container">
        <button
          type="button"
          className="stoka-manager-menu-button"
          aria-label="Open manager menu"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((previous) => !previous)}
        >
          ⋮
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="stoka-manager-menu-backdrop"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />

            <div className="stoka-manager-overflow-menu">
              <div className="stoka-manager-menu-heading">
                Manager Menu
              </div>

              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    unlocked && !showSettings && activeTab === item.id
                      ? "stoka-manager-menu-item active"
                      : "stoka-manager-menu-item"
                  }
                  onClick={() => handleMenuSelect(item.id)}
                >
                  

                  <span>{item.label}</span>

                  <span className="stoka-manager-menu-arrow">›</span>
                </button>
              ))}

              <div className="stoka-manager-menu-divider" />

              <button
                type="button"
                className={
                  showSettings
                    ? "stoka-manager-menu-item active"
                    : "stoka-manager-menu-item"
                }
                onClick={() => handleMenuSelect("More")}
              >
                
                <span>More</span>
                <span className="stoka-manager-menu-arrow">›</span>
              </button>

              

              <div className="stoka-manager-menu-divider" />

              <button
                type="button"
                className="stoka-manager-menu-item stoka-manager-home-item"
                onClick={handleHomeClick}
              >
                
                <span>Back to Home</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );

  if (!unlocked) {
    return (
      <ManagerLogin
        business={business}
        onBack={onBack}
        onLogin={() => {
          setUnlocked(true);
          setActiveTab("Stock");
          setShowSettings(false);
          setMenuOpen(false);
          clearMessages();
        }}
      />
    );
  }

  return (
    <main className="stoka-manager-page">
      {renderHeader()}

      <section className="stoka-manager-workspace">
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
            <div className="manager-content manager-settings-grid">
              <section className="card manager-password-card">
                <div className="manager-panel-heading">
                  <h3>Change business login password</h3>
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
                    {loading
                      ? "Updating..."
                      : "Change business password"}
                  </button>
                </form>
              </section>

              <section className="card manager-password-card">
                <div className="manager-panel-heading">
                  <h3>Send feedback</h3>
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
                      rows={8}
                      maxLength={3000}
                      required
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        resize: "vertical",
                        backgroundColor: "white",
                      }}
                    />
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
                  <h3>Contact Stoka</h3>
                </div>

                <p>
                  Contact us on WhatsApp if you need help with Stoka.
                </p>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    "Hello, I need assistance with Stoka."
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
                  WhatsApp Us
                </a>
              </section>

              <section className="card manager-password-card">
                <div className="manager-panel-heading">
                  <h3>Subscribe to Stoka</h3>
                </div>

                <p>
                  Subscription activation is currently handled manually.
                  After following the phone prompts, please contact Stoka
                  to confirm your subscription or if you need help.
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
                  Subscribe
                </a>

                <p className="manager-security-note">
                  This button opens your phone's dialer where supported.
                  It does not automatically activate or confirm a subscription.
                </p>
              </section>
            </div>
          </section>
        ) : (
          <section className="manager-selected-section">
            <div className="manager-content">
              {activeTab === "Stock" && (
                <Stock business={business} />
              )}

              {activeTab === "Purchases" && (
                <AddStock business={business} />
              )}

              {activeTab === "IE" && (
                <IE business={business} />
              )}

              {activeTab === "Tellers" && (
                <TellerHistory businessId={businessId} />
              )}

              {activeTab === "Reports" && (
                <Reports
                  business={business}
                  businessId={businessId}
                />
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

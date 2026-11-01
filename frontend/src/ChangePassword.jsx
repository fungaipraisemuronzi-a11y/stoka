import { useState } from "react";
import "./Sales.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function ChangePassword({
  business,
  tellerId,
  tellerName,
  onBack,
}) {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setMessage("Please fill in all password fields.");
      setMessageType("error");
      return;
    }

    if (newPassword.length < 6) {
      setMessage(
        "The new password must contain at least 6 characters."
      );
      setMessageType("error");
      return;
    }

    if (newPassword === currentPassword) {
      setMessage(
        "The new password must be different from the current password."
      );
      setMessageType("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/tellers/${encodeURIComponent(
          tellerId
        )}/change-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId: business.id,
            currentPassword,
            newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to change password."
        );
      }

      setMessage(
        data.message || "Password changed successfully."
      );
      setMessageType("success");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(
        error.message || "An unexpected error occurred."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sales-page">
     

      <section className="password-page-card">
        <div className="password-page-heading">
         
        

          <h1>Change your Password</h1>

          
        </div>

        {message && (
          <div
            className={`password-message ${
              messageType === "success"
                ? "success"
                : "error"
            }`}
            role="status"
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="password-form-group">
            <label htmlFor="currentPassword">
              Current Password
            </label>

            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(event.target.value)
              }
              placeholder="Enter current password"
              disabled={loading}
              required
            />
          </div>

          <div className="password-form-group">
            <label htmlFor="newPassword">
              New Password
            </label>

            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              placeholder="Enter new password"
              minLength={4}
              disabled={loading}
              required
            />
          </div>

          <div className="password-form-group">
            <label htmlFor="confirmPassword">
              Confirm New Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Re-enter new password"
              minLength={4}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="primary-button password-submit-button"
            disabled={loading}
          >
            {loading
              ? "Changing Password..."
              : "Change Password"}
          </button>
        </form>

        <button
          type="button"
          className="back-button"
          onClick={onBack}
          disabled={loading}
        >
          Go Back
        </button>
      </section>
    </main>
  );
}

import { useState } from "react";
import "./BusinessProfile.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function BusinessProfile({ business, onBusinessUpdated }) {
  const [businessName, setBusinessName] = useState(
    business?.businessName || business?.business_name || business?.name || ""
  );

  const [username, setUsername] = useState(business?.username || "");

  const [currentBusinessPassword, setCurrentBusinessPassword] = useState("");
  const [newBusinessPassword, setNewBusinessPassword] = useState("");
  const [confirmBusinessPassword, setConfirmBusinessPassword] = useState("");

  const [currentManagerPassword, setCurrentManagerPassword] = useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");
  const [confirmManagerPassword, setConfirmManagerPassword] = useState("");

  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const businessId = business?.id;

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const getData = async (response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  // Update business information
  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!businessId || !currentBusinessPassword) {
      setError("Please enter your current business password.");
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(username.trim())) {
      setError("Username must contain letters and numbers only.");
      return;
    }

    setLoading("profile");

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: String(businessId),
          businessName,
          username: username.trim().toLowerCase(),
          currentPassword: currentBusinessPassword,
        }),
      });

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(data.message || "Could not update profile.");
      }

      localStorage.setItem("stoka_business", JSON.stringify(data.business));

      onBusinessUpdated?.(data.business);

      setCurrentBusinessPassword("");
      setMessage(data.message || "Business profile updated successfully.");
    } catch (err) {
      setError(err.message || "Could not update business profile.");
    } finally {
      setLoading("");
    }
  };

  // Change business password
  const handleBusinessPasswordChange = async (event) => {
    event.preventDefault();
    clearMessages();

    if (newBusinessPassword.length > 15) {
      setError("Password cannot exceed 15 characters.");
      return;
    }

    if (newBusinessPassword !== confirmBusinessPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentBusinessPassword === newBusinessPassword) {
      setError("New password must differ from the current password.");
      return;
    }

    setLoading("business-password");

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: String(businessId),
          currentPassword: currentBusinessPassword,
          newPassword: newBusinessPassword,
        }),
      });

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(data.message || "Could not change password.");
      }

      setCurrentBusinessPassword("");
      setNewBusinessPassword("");
      setConfirmBusinessPassword("");

      setMessage(data.message || "Business password changed successfully.");
    } catch (err) {
      setError(err.message || "Could not change business password.");
    } finally {
      setLoading("");
    }
  };

  // Change manager password
  const handleManagerPasswordChange = async (event) => {
    event.preventDefault();
    clearMessages();

    if (newManagerPassword.length < 6) {
      setError("Manager password must contain at least 6 characters.");
      return;
    }

    if (newManagerPassword !== confirmManagerPassword) {
      setError("New manager passwords do not match.");
      return;
    }

    if (currentManagerPassword === newManagerPassword) {
      setError("New password must differ from the current password.");
      return;
    }

    setLoading("manager-password");

    try {
      const response = await fetch(
        `${API_URL}/api/manager-passwords/change`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: String(businessId),
            currentPassword: currentManagerPassword,
            newPassword: newManagerPassword,
          }),
        }
      );

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(data.message || "Could not change manager password.");
      }

      setCurrentManagerPassword("");
      setNewManagerPassword("");
      setConfirmManagerPassword("");

      setMessage(data.message || "Manager password changed successfully.");
    } catch (err) {
      setError(err.message || "Could not change manager password.");
    } finally {
      setLoading("");
    }
  };

  // Delete business account
  const handleDeleteBusiness = async () => {
    clearMessages();

    const confirmed = window.confirm(
      "WARNING: You are about to permanently delete this business account.\n\n" +
      "This action cannot be undone.\n\n" +
      "Do you want to continue?"
    );

    if (!confirmed) return;

    const password = window.prompt(
      "Enter your current business password to confirm account deletion:"
    );

    if (password === null || !password.trim()) {
      return;
    }

    setLoading("delete");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/delete/${encodeURIComponent(businessId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: password,
          }),
        }
      );

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not delete business account."
        );
      }

      localStorage.removeItem("stoka_business");
      localStorage.removeItem("stoka_teller");

      alert("Business account deleted successfully.");

      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Could not delete business account.");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="business-profile-page">

      <div className="business-profile-heading">
        <div>
          <h2>Business Profile</h2>
          <p>Manage your business information and account security.</p>
        </div>
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* BUSINESS INFORMATION */}
      <section className="business-profile-card">
        <div className="business-profile-card-heading">
          <span className="business-profile-icon">🏢</span>
          <div>
            <h3>Business information</h3>
            <p>Update your business name and login username.</p>
          </div>
        </div>

        <form onSubmit={handleProfileUpdate}>
          <div className="business-profile-fields">

            <div className="form-group">
              <label>Business name</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={25}
                required
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(0, 15)
                  )
                }
                maxLength={15}
                pattern="[a-zA-Z0-9]+"
                title="Letters and numbers only."
                required
              />
              <small>Letters and numbers only. Maximum 15 characters.</small>
            </div>

            <div className="form-group">
              <label>Current business password</label>
              <input
                type="password"
                value={currentBusinessPassword}
                onChange={(e) => setCurrentBusinessPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <small>Required to confirm profile changes.</small>
            </div>

          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(loading)}
          >
            {loading === "profile" ? "Saving..." : "Save business information"}
          </button>
        </form>
      </section>

      {/* BUSINESS PASSWORD */}
      <section className="business-profile-card">
        <div className="business-profile-card-heading">
          <span className="business-profile-icon">🔐</span>
          <div>
            <h3>Business login password</h3>
            <p>Change the password used to log into Stoka.</p>
          </div>
        </div>

        <form onSubmit={handleBusinessPasswordChange}>
          <div className="business-profile-fields">

            <div className="form-group">
              <label>Current password</label>
              <input
                type="password"
                value={currentBusinessPassword}
                onChange={(e) => setCurrentBusinessPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                value={newBusinessPassword}
                onChange={(e) => setNewBusinessPassword(e.target.value)}
                maxLength={15}
                required
              />
              <small>Maximum 15 characters.</small>
            </div>

            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirmBusinessPassword}
                onChange={(e) => setConfirmBusinessPassword(e.target.value)}
                maxLength={15}
                required
              />
            </div>

          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(loading)}
          >
            {loading === "business-password"
              ? "Updating..."
              : "Change business password"}
          </button>
        </form>
      </section>

      {/* MANAGER PASSWORD */}
      <section className="business-profile-card">
        <div className="business-profile-card-heading">
          <span className="business-profile-icon">🛡️</span>
          <div>
            <h3>Manager password</h3>
            <p>Change the password protecting the manager workspace.</p>
          </div>
        </div>

        <form onSubmit={handleManagerPasswordChange}>
          <div className="business-profile-fields">

            <div className="form-group">
              <label>Current manager password</label>
              <input
                type="password"
                value={currentManagerPassword}
                onChange={(e) => setCurrentManagerPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New manager password</label>
              <input
                type="password"
                value={newManagerPassword}
                onChange={(e) => setNewManagerPassword(e.target.value)}
                minLength={6}
                required
              />
              <small>At least 6 characters.</small>
            </div>

            <div className="form-group">
              <label>Confirm new manager password</label>
              <input
                type="password"
                value={confirmManagerPassword}
                onChange={(e) => setConfirmManagerPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={Boolean(loading)}
          >
            {loading === "manager-password"
              ? "Updating..."
              : "Change manager password"}
          </button>
        </form>
      </section>

      {/* DELETE BUSINESS ACCOUNT */}
      <section className="business-profile-card delete-business-card">
        <div className="business-profile-card-heading">
          <span className="business-profile-icon">⚠️</span>
          <div>
            <h3>Delete business account</h3>
            <p>
              Permanently delete this business account from Stoka.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="delete-business-button"
          onClick={handleDeleteBusiness}
          disabled={Boolean(loading) || !businessId}
        >
          {loading === "delete"
            ? "Deleting account..."
            : "Delete Business Account"}
        </button>
      </section>

    </div>
  );
}

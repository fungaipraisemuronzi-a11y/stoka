
import { useEffect, useState } from "react";
import "./BusinessProfile.css";

const API_URL = "https://stoka-of78.onrender.com";

const getBusinessName = (business) =>
  business?.businessName ||
  business?.business_name ||
  business?.name ||
  "";

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  autoComplete = "current-password",
  minLength,
  maxLength,
  required = true,
}) {
  return (
    <div className="bp-field">
      <label htmlFor={id}>{label}</label>

      <div className="bp-password-input">
       

        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
        />

        <button
          type="button"
          className="bp-password-toggle"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "◉" : "◉̸"}
        </button>
      </div>
    </div>
  );
}

export default function BusinessProfile({
  business,
  managerToken,
  onBusinessUpdated,
}) {
  const [businessName, setBusinessName] = useState(
    getBusinessName(business)
  );

  const [username, setUsername] = useState(
    business?.username || ""
  );

  const [businessNamePassword, setBusinessNamePassword] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");

  const [currentBusinessPassword, setCurrentBusinessPassword] =
    useState("");
  const [newBusinessPassword, setNewBusinessPassword] = useState("");
  const [confirmBusinessPassword, setConfirmBusinessPassword] =
    useState("");

  const [currentManagerPassword, setCurrentManagerPassword] =
    useState("");
  const [newManagerPassword, setNewManagerPassword] = useState("");
  const [confirmManagerPassword, setConfirmManagerPassword] =
    useState("");

  const [showNamePassword, setShowNamePassword] = useState(false);
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);

  const [showBusinessOld, setShowBusinessOld] = useState(false);
  const [showBusinessNew, setShowBusinessNew] = useState(false);
  const [showBusinessConfirm, setShowBusinessConfirm] = useState(false);

  const [showManagerOld, setShowManagerOld] = useState(false);
  const [showManagerNew, setShowManagerNew] = useState(false);
  const [showManagerConfirm, setShowManagerConfirm] = useState(false);

  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const businessId = business?.id;

  useEffect(() => {
    setBusinessName(getBusinessName(business));
    setUsername(business?.username || "");
  }, [business]);

  function clearMessages() {
    setMessage("");
    setError("");
  }

  async function getData(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function updateBusinessLocally(updatedBusiness) {
    if (!updatedBusiness) return;

    localStorage.setItem(
      "stoka_business",
      JSON.stringify(updatedBusiness)
    );

    onBusinessUpdated?.(updatedBusiness);

    setBusinessName(getBusinessName(updatedBusiness));
    setUsername(updatedBusiness.username || "");
  }

  // --------------------------------------------------
  // UPDATE BUSINESS NAME
  // PATCH /api/auth/profile
  // --------------------------------------------------
  async function handleBusinessNameSave(event) {
    event.preventDefault();
    clearMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!businessNamePassword) {
      setError("Enter your current business password.");
      return;
    }

    setLoading("business-name");

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: String(businessId),
          businessName: businessName.trim(),
          username: username.trim().toLowerCase(),
          currentPassword: businessNamePassword,
        }),
      });

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not update business name."
        );
      }

      if (data.business) {
        updateBusinessLocally(data.business);
      }

      setBusinessNamePassword("");
      setMessage("Business name updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  // --------------------------------------------------
  // UPDATE USERNAME
  // PATCH /api/auth/profile
  // --------------------------------------------------
  async function handleUsernameSave(event) {
    event.preventDefault();
    clearMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!/^[a-zA-Z0-9]+$/.test(cleanUsername)) {
      setError("Username must contain letters and numbers only.");
      return;
    }

    if (!usernamePassword) {
      setError("Enter your current business password.");
      return;
    }

    setLoading("username");

    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: String(businessId),
          businessName: businessName.trim(),
          username: cleanUsername,
          currentPassword: usernamePassword,
        }),
      });

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not update username."
        );
      }

      if (data.business) {
        updateBusinessLocally(data.business);
      }

      setUsernamePassword("");
      setMessage("Username updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  // --------------------------------------------------
  // CHANGE BUSINESS LOGIN PASSWORD
  // POST /api/auth/change-password
  // --------------------------------------------------
  async function handleBusinessPasswordChange(event) {
    event.preventDefault();
    clearMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (
      !currentBusinessPassword ||
      !newBusinessPassword ||
      !confirmBusinessPassword
    ) {
      setError("Complete all business password fields.");
      return;
    }

    if (newBusinessPassword.length > 15) {
      setError("Business password cannot exceed 15 characters.");
      return;
    }

    if (newBusinessPassword !== confirmBusinessPassword) {
      setError("New business passwords do not match.");
      return;
    }

    if (currentBusinessPassword === newBusinessPassword) {
      setError("New password must differ from the current password.");
      return;
    }

    setLoading("business-password");

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
            currentPassword: currentBusinessPassword,
            newPassword: newBusinessPassword,
          }),
        }
      );

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not change business password."
        );
      }

      setCurrentBusinessPassword("");
      setNewBusinessPassword("");
      setConfirmBusinessPassword("");

      setShowBusinessOld(false);
      setShowBusinessNew(false);
      setShowBusinessConfirm(false);

      setMessage("Business login password changed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  // --------------------------------------------------
  // CHANGE MANAGER LOGIN PASSWORD
  // PATCH /api/manager-passwords/change-password
  // Requires manager JWT
  // --------------------------------------------------
  async function handleManagerPasswordChange(event) {
    event.preventDefault();
    clearMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!managerToken) {
      setError(
        "Manager session is missing. Please log out and log in to the Manager account again."
      );
      return;
    }

    if (
      !currentManagerPassword ||
      !newManagerPassword ||
      !confirmManagerPassword
    ) {
      setError("Complete all manager password fields.");
      return;
    }

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
        `${API_URL}/api/manager-passwords/change-password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${managerToken}`,
          },
          body: JSON.stringify({
            currentPassword: currentManagerPassword,
            newPassword: newManagerPassword,
          }),
        }
      );

      const data = await getData(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Could not change manager password."
        );
      }

      setCurrentManagerPassword("");
      setNewManagerPassword("");
      setConfirmManagerPassword("");

      setShowManagerOld(false);
      setShowManagerNew(false);
      setShowManagerConfirm(false);

      setMessage("Manager login password changed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  // --------------------------------------------------
  // RESET ALL FIELDS
  // --------------------------------------------------
  function resetForm() {
    setBusinessName(getBusinessName(business));
    setUsername(business?.username || "");

    setBusinessNamePassword("");
    setUsernamePassword("");

    setCurrentBusinessPassword("");
    setNewBusinessPassword("");
    setConfirmBusinessPassword("");

    setCurrentManagerPassword("");
    setNewManagerPassword("");
    setConfirmManagerPassword("");

    setShowNamePassword(false);
    setShowUsernamePassword(false);

    setShowBusinessOld(false);
    setShowBusinessNew(false);
    setShowBusinessConfirm(false);

    setShowManagerOld(false);
    setShowManagerNew(false);
    setShowManagerConfirm(false);

    clearMessages();
  }

  // --------------------------------------------------
  // DELETE BUSINESS ACCOUNT
  // DELETE /api/auth/delete/:id
  // --------------------------------------------------
  async function handleDeleteBusiness() {
    clearMessages();

    if (!businessId) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    const confirmed = window.confirm(
      "WARNING: You are about to permanently delete this business account.\n\n" +
      "This action cannot be undone.\n\n" +
      "Do you want to continue?"
    );

    if (!confirmed) return;

    const password = window.prompt(
      "Enter your current business password to confirm account deletion:"
    );

    if (password === null || !password.trim()) return;

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
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="business-profile-page">
     

      {message && (
        <div className="bp-alert bp-success" role="status">
          <span>✓</span>
          {message}
        </div>
      )}

      {error && (
        <div className="bp-alert bp-error" role="alert">
          <span>!</span>
          {error}
        </div>
      )}

      {/* BUSINESS NAME */}
      <div className="bp-information-grid">
        <section className="bp-information-card">
          <div className="bp-card-header">
           
            <h3>Business Name</h3>
          </div>

          <form
            className="bp-card-content"
            onSubmit={handleBusinessNameSave}
          >
            <div className="bp-field">
             

              <input
                id="bp-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={25}
                required
              />

              
            </div>

            <div className="bp-profile-confirm">
              <label htmlFor="bp-name-password">
                Enter your business password to change
              </label>

              <div className="bp-password-input">
                <input
                  id="bp-name-password"
                  type={showNamePassword ? "text" : "password"}
                  value={businessNamePassword}
                  onChange={(e) =>
                    setBusinessNamePassword(e.target.value)
                  }
                  placeholder="Confirm your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="bp-password-toggle"
                  onClick={() => setShowNamePassword((v) => !v)}
                >
                  {showNamePassword ? "◉" : "◉̸"}
                </button>
              </div>
            </div>

            <button
              className="bp-save-button bp-section-save"
              type="submit"
              disabled={Boolean(loading)}
            >
              {loading === "business-name"
                ? "Saving..."
                : "✓ Save Business Name"}
            </button>
          </form>
        </section>

        {/* USERNAME */}
        <section className="bp-information-card">
          <div className="bp-card-header">
           
            <h3>Username</h3>
          </div>

          <form
            className="bp-card-content"
            onSubmit={handleUsernameSave}
          >
            <div className="bp-field">
             

              <input
                id="bp-username"
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
                required
              />

             
            </div>

            <div className="bp-profile-confirm">
              <label htmlFor="bp-username-password">
                Enter your business password to change
              </label>

              <div className="bp-password-input">
                <input
                  id="bp-username-password"
                  type={showUsernamePassword ? "text" : "password"}
                  value={usernamePassword}
                  onChange={(e) =>
                    setUsernamePassword(e.target.value)
                  }
                  placeholder="Confirm your password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="bp-password-toggle"
                  onClick={() => setShowUsernamePassword((v) => !v)}
                >
                  {showUsernamePassword ? "◉" : "◉̸"}
                </button>
              </div>
            </div>

            <button
              className="bp-save-button bp-section-save"
              type="submit"
              disabled={Boolean(loading)}
            >
              {loading === "username"
                ? "Saving..."
                : "✓ Save Username"}
            </button>
          </form>
        </section>
      </div>

      {/* BUSINESS LOGIN PASSWORD */}
      <section className="bp-password-card">
        <div className="bp-section-heading">
        
          <div>
            <h3>Change Business Login Password</h3>
           
          </div>
        </div>

        <form onSubmit={handleBusinessPasswordChange}>
          <div className="bp-password-grid">
            <PasswordField
              id="bp-business-old"
              label="Old Password"
              value={currentBusinessPassword}
              onChange={(e) =>
                setCurrentBusinessPassword(e.target.value)
              }
              placeholder="Enter old password"
              visible={showBusinessOld}
              onToggle={() => setShowBusinessOld((v) => !v)}
            />

            <PasswordField
              id="bp-business-new"
              label="New Password"
              value={newBusinessPassword}
              onChange={(e) => setNewBusinessPassword(e.target.value)}
              placeholder="Enter new password"
              visible={showBusinessNew}
              onToggle={() => setShowBusinessNew((v) => !v)}
              autoComplete="new-password"
              maxLength={15}
            />

            <PasswordField
              id="bp-business-confirm"
              label="Confirm New Password"
              value={confirmBusinessPassword}
              onChange={(e) =>
                setConfirmBusinessPassword(e.target.value)
              }
              placeholder="Confirm new password"
              visible={showBusinessConfirm}
              onToggle={() => setShowBusinessConfirm((v) => !v)}
              autoComplete="new-password"
              maxLength={15}
            />
          </div>

          

          <div className="bp-individual-actions">
            <button
              type="button"
              className="bp-reset-button"
              onClick={() => {
                setCurrentBusinessPassword("");
                setNewBusinessPassword("");
                setConfirmBusinessPassword("");
                setShowBusinessOld(false);
                setShowBusinessNew(false);
                setShowBusinessConfirm(false);
                clearMessages();
              }}
              disabled={Boolean(loading)}
            >
              Reset
            </button>

            <button
              type="submit"
              className="bp-save-button"
              disabled={Boolean(loading)}
            >
              {loading === "business-password"
                ? "Updating..."
                : "✓ Save Business Password"}
            </button>
          </div>
        </form>
      </section>

      {/* MANAGER LOGIN PASSWORD */}
      <section className="bp-password-card">
        <div className="bp-section-heading">
         
          <div>
            <h3>Change Manager Password</h3>
           
          </div>
        </div>

        <form onSubmit={handleManagerPasswordChange}>
          <div className="bp-password-grid">
            <PasswordField
              id="bp-manager-old"
              label="Old Password"
              value={currentManagerPassword}
              onChange={(e) =>
                setCurrentManagerPassword(e.target.value)
              }
              placeholder="Enter old password"
              visible={showManagerOld}
              onToggle={() => setShowManagerOld((v) => !v)}
            />

            <PasswordField
              id="bp-manager-new"
              label="New Password"
              value={newManagerPassword}
              onChange={(e) => setNewManagerPassword(e.target.value)}
              placeholder="Enter new password"
              visible={showManagerNew}
              onToggle={() => setShowManagerNew((v) => !v)}
              autoComplete="new-password"
              minLength={6}
            />

            <PasswordField
              id="bp-manager-confirm"
              label="Confirm New Password"
              value={confirmManagerPassword}
              onChange={(e) =>
                setConfirmManagerPassword(e.target.value)
              }
              placeholder="Confirm new password"
              visible={showManagerConfirm}
              onToggle={() => setShowManagerConfirm((v) => !v)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="bp-individual-actions">
            <button
              type="button"
              className="bp-reset-button"
              onClick={() => {
                setCurrentManagerPassword("");
                setNewManagerPassword("");
                setConfirmManagerPassword("");
                setShowManagerOld(false);
                setShowManagerNew(false);
                setShowManagerConfirm(false);
                clearMessages();
              }}
              disabled={Boolean(loading)}
            >
              Reset
            </button>

            <button
              type="submit"
              className="bp-save-button"
              disabled={Boolean(loading)}
            >
              {loading === "manager-password"
                ? "Updating..."
                : "✓ Save Manager Password"}
            </button>
          </div>
        </form>
      </section>

      {/* RESET ALL */}
      <div className="bp-actions">
        <button
          type="button"
          className="bp-reset-button"
          onClick={resetForm}
          disabled={Boolean(loading)}
        >
          ↶ Reset All
        </button>
      </div>

      {/* DELETE BUSINESS */}
      <section className="bp-delete-card">
       

        <button
          type="button"
          onClick={handleDeleteBusiness}
          disabled={Boolean(loading) || !businessId}
        >
          {loading === "delete"
            ? "Deleting..."
            : "Delete Business Account"}
        </button>
      </section>
    </div>
  );
}
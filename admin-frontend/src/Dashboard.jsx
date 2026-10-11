import { useCallback, useEffect, useState } from "react";
import "./Dashboard.css";

const API_URL = "https://stoka-of78.onrender.com";

export default function Dashboard({ onLogout }) {
  const [page, setPage] = useState("businesses");
  const [businesses, setBusinesses] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const admin = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("stoka_admin_user") || "{}"
      );
    } catch {
      return {};
    }
  })();

  const request = useCallback(async (endpoint, options = {}) => {
    const token = sessionStorage.getItem("stoka_admin_token");

    if (!token) {
      onLogout();
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      onLogout();
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "The request failed.");
    }

    return data;
  }, [onLogout]);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await request("/api/admin/businesses");
      setBusinesses(data.businesses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await request("/api/admin/feedback");
      setFeedback(data.feedback || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (page === "businesses") {
      loadBusinesses();
    } else {
      loadFeedback();
    }
  }, [page, loadBusinesses, loadFeedback]);

  async function toggleBusiness(business) {
    const nextStatus = !business.isActive;
    const confirmed = window.confirm(
      `${nextStatus ? "Activate" : "Deactivate"} ${business.businessName}?`
    );

    if (!confirmed) return;

    setBusyId(business.id);
    setError("");
    setNotice("");

    try {
      const data = await request(
        `/api/admin/businesses/${encodeURIComponent(business.id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextStatus }),
        }
      );

      setBusinesses((current) =>
        current.map((item) =>
          item.id === business.id ? data.business : item
        )
      );

      setNotice(data.message || "Business status updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  const normalizedSearch = search.trim().toLowerCase();

  const filteredBusinesses = businesses.filter((business) =>
    [
      business.id,
      business.businessName,
      business.location,
      business.phone,
    ].some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch)
    )
  );

  const activeCount = businesses.filter(
    (business) => business.isActive
  ).length;

  const inactiveCount = businesses.length - activeCount;

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">S</div>
          <div>
            <strong>STOKA</strong>
            <span>ADMINISTRATION</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <button
          className={`nav-item ${page === "businesses" ? "selected" : ""}`}
          onClick={() => {
            setSearch("");
            setPage("businesses");
          }}
        >
          <span>▦</span> Businesses
        </button>

        <button
          className={`nav-item ${page === "feedback" ? "selected" : ""}`}
          onClick={() => setPage("feedback")}
        >
          <span>✉</span> Feedback
        </button>

        <div className="sidebar-bottom">
          <div className="admin-profile">
            <div className="profile-avatar">
              {(admin.username || "A").charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{admin.username || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout}>
            ↪ Log out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="topbar-caption">STOKA MANAGEMENT</span>
            <h1>
              {page === "businesses" ? "Businesses" : "Feedback"}
            </h1>
          </div>

          <div className="admin-status">
            <span className="status-dot" />
            Admin portal
          </div>
        </header>

        <section className="admin-content">
          {error && (
            <div className="dashboard-alert error-alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="dashboard-alert success-alert">
              {notice}
            </div>
          )}

          {page === "businesses" ? (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="stat-label">Total businesses</span>
                  <strong>{businesses.length}</strong>
                  <span className="stat-description">
                    All registered accounts
                  </span>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Active accounts</span>
                  <strong className="active-number">{activeCount}</strong>
                  <span className="stat-description">
                    Accounts allowed to log in
                  </span>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Inactive accounts</span>
                  <strong className="inactive-number">{inactiveCount}</strong>
                  <span className="stat-description">
                    Accounts currently blocked
                  </span>
                </div>
              </div>

              <section className="content-panel">
                <div className="panel-header">
                  <div>
                    <h2>Registered businesses</h2>
                    <p>View and manage business account access.</p>
                  </div>

                  <button
                    className="refresh-button"
                    onClick={loadBusinesses}
                    disabled={loading}
                  >
                    ↻ Refresh
                  </button>
                </div>

                <div className="table-toolbar">
                  <input
                    className="search-input"
                    type="search"
                    placeholder="Search ID, business, location or phone..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <span className="result-count">
                    {filteredBusinesses.length} businesses
                  </span>
                </div>

                {loading ? (
                  <div className="empty-state">Loading businesses...</div>
                ) : filteredBusinesses.length === 0 ? (
                  <div className="empty-state">
                    {businesses.length === 0
                      ? "No businesses have been registered yet."
                      : "No businesses match your search."}
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Business ID</th>
                          <th>Business name</th>
                          <th>Location</th>
                          <th>Phone</th>
                          <th>Registered</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredBusinesses.map((business) => (
                          <tr key={business.id}>
                            <td className="business-id">{business.id}</td>
                            <td className="business-name">
                              {business.businessName}
                            </td>
                            <td>{business.location}</td>
                            <td>{business.phone}</td>
                            <td>{formatDate(business.createdAt)}</td>
                            <td>
                              <span
                                className={`status-badge ${
                                  business.isActive ? "active" : "inactive"
                                }`}
                              >
                                {business.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <button
                                className={`action-button ${
                                  business.isActive
                                    ? "deactivate"
                                    : "activate"
                                }`}
                                disabled={busyId === business.id}
                                onClick={() => toggleBusiness(business)}
                              >
                                {busyId === business.id
                                  ? "Saving..."
                                  : business.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="content-panel">
              <div className="panel-header">
                <div>
                  <h2>Business feedback</h2>
                  <p>Messages submitted by registered businesses.</p>
                </div>

                <button
                  className="refresh-button"
                  onClick={loadFeedback}
                  disabled={loading}
                >
                  ↻ Refresh
                </button>
              </div>

              {loading ? (
                <div className="empty-state">Loading feedback...</div>
              ) : feedback.length === 0 ? (
                <div className="empty-state">
                  No feedback submissions yet.
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date submitted</th>
                        <th>Business ID</th>
                        <th>Business name</th>
                        <th>Message</th>
                      </tr>
                    </thead>

                    <tbody>
                      {feedback.map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.created_at)}</td>
                          <td className="business-id">
                            {item.business_id || "—"}
                          </td>
                          <td className="business-name">
                            {item.business_name || "Unknown business"}
                          </td>
                          <td className="feedback-message">
                            {item.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </section>

        <footer className="dashboard-footer">
          Stoka Administration · Business and feedback management
        </footer>
      </main>
    </div>
  );
}
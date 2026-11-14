import { useCallback, useEffect, useState } from "react";
import "./ManageUsers.css";

const API_URL = "https://stoka-of78.onrender.com";

const FILTERS = ["All", "Pending", "Approved", "Inactive"];

const ACTION_LABELS = {
  approve: "approved",
  reject: "rejected",
  deactivate: "deactivated",
  reactivate: "reactivated",
  delete: "deleted",
};

export default function ManageUsers({
  business,
  manager,
  managerToken,
}) {
  const [users, setUsers] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const businessId = business?.id;

  const isPrimaryManager =
    manager?.isPrimary === true ||
    manager?.is_primary === true;

  // Read API responses safely
  const readResponse = async (response) => {
    const text = await response.text();

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  };

  // Common request headers
  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${managerToken}`,
  });

  // Load tellers and managers
  const fetchUsers = useCallback(async () => {
    if (!businessId || !managerToken || !isPrimaryManager) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${managerToken}`,
      };

      const [tellerResponse, managerResponse] = await Promise.all([
        fetch(
          `${API_URL}/api/tellers/business/${businessId}`,
          { headers }
        ),
        fetch(
          `${API_URL}/api/manager-passwords/accounts`,
          { headers }
        ),
      ]);

      const tellerData = await readResponse(tellerResponse);
      const managerData = await readResponse(managerResponse);

      if (!tellerResponse.ok) {
        throw new Error(
          tellerData.message || "Failed to load tellers."
        );
      }

      if (!managerResponse.ok) {
        throw new Error(
          managerData.message || "Failed to load managers."
        );
      }

      const tellerList = Array.isArray(tellerData)
        ? tellerData
        : tellerData.tellers || [];

      const managerList = Array.isArray(managerData)
        ? managerData
        : managerData.managers || [];

      const formattedTellers = tellerList.map((teller) => ({
        id: teller.id,
        accountType: "Teller",
        username:
          teller.username ||
          teller.name ||
          teller.tellerName ||
          "Unnamed teller",
        approvalStatus: String(
          teller.approvalStatus ??
          teller.approval_status ??
          "approved"
        ).toLowerCase(),
        isActive:
          teller.isActive ?? teller.is_active ?? true,
        isDeleted:
          teller.isDeleted ?? teller.is_deleted ?? false,
        createdAt:
          teller.requestedAt ||
          teller.requested_at ||
          teller.createdAt ||
          teller.created_at ||
          null,
        isPrimary: false,
      }));

      const formattedManagers = managerList.map((item) => ({
        id: item.id,
        accountType: "Manager",
        username: item.username || "Unnamed manager",
        approvalStatus: String(
          item.status || "pending"
        ).toLowerCase(),
        isActive:
          item.isActive ?? item.is_active ?? false,
        isDeleted:
          item.isDeleted ?? item.is_deleted ?? false,
        createdAt:
          item.createdAt || item.created_at || null,
        isPrimary:
          item.isPrimary ?? item.is_primary ?? false,
      }));

      setUsers([
        ...formattedTellers,
        ...formattedManagers,
      ]);
    } catch (err) {
      setError(err.message || "Unable to load user accounts.");
    } finally {
      setLoading(false);
    }
  }, [businessId, managerToken, isPrimaryManager]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Determine account status
  const getStatus = (user) => {
    if (user.isDeleted) return "Deleted";

    if (user.approvalStatus === "pending") {
      return "Pending";
    }

    if (user.approvalStatus === "rejected") {
      return "Rejected";
    }

    return user.isActive ? "Approved" : "Inactive";
  };

  // Calculate filter counts
  const getCounts = () => {
    const result = {
      All: 0,
      Pending: 0,
      Approved: 0,
      Inactive: 0,
    };

    users.forEach((user) => {
      const status = getStatus(user);

      if (status === "Deleted") return;

      result.All += 1;

      if (result[status] !== undefined) {
        result[status] += 1;
      }
    });

    return result;
  };

  const counts = getCounts();

  // Filter accounts
  const filteredUsers = users.filter((user) => {
    const status = getStatus(user);

    if (activeFilter === "All") return true;

    return status === activeFilter;
  });

  // Perform account actions
  const performAction = async (user, action) => {
    if (!isPrimaryManager) {
      setError("Only the Primary Manager can manage accounts.");
      return;
    }

    if (user.isPrimary || user.isDeleted) return;

    const confirmation = window.confirm(
      `Are you sure you want to ${action} ${user.username}?`
    );

    if (!confirmation) return;

    const actionKey = `${user.accountType}-${user.id}`;

    setProcessing(actionKey);
    setError("");
    setSuccess("");

    try {
      let url = "";
      let method = "POST";
      let body;

      if (user.accountType === "Teller") {
        switch (action) {
          case "approve":
          case "reject":
            url = `${API_URL}/api/tellers/${user.id}/${action}`;
            method = "PATCH";
            break;

          case "deactivate":
          case "reactivate":
            url = `${API_URL}/api/tellers/${user.id}/status`;
            method = "PATCH";
            body = JSON.stringify({
              isActive: action === "reactivate",
            });
            break;

          case "delete":
            url = `${API_URL}/api/tellers/${user.id}`;
            method = "DELETE";
            break;

          default:
            throw new Error("Invalid teller action.");
        }
      } else {
        const managerActions = [
          "approve",
          "reject",
          "deactivate",
          "reactivate",
          "delete",
        ];

        if (!managerActions.includes(action)) {
          throw new Error("Invalid manager action.");
        }

        url = `${API_URL}/api/manager-passwords/accounts/${user.id}/${action}`;
        method = "POST";
      }

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        ...(body ? { body } : {}),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || `Failed to ${action} account.`
        );
      }

      setSuccess(
        `${user.username} has been ${ACTION_LABELS[action]} successfully.`
      );

      await fetchUsers();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setProcessing("");
    }
  };

  // Account action buttons
  const renderActions = (user) => {
    const status = getStatus(user);
    const isProcessing =
      processing === `${user.accountType}-${user.id}`;

    if (user.isDeleted || user.isPrimary) {
      return (
        <span className="manage-users-no-actions">—</span>
      );
    }

    if (status === "Pending") {
      return (
        <div className="manage-users-actions">
          <button
            type="button"
            className="manage-users-approve"
            disabled={Boolean(processing)}
            onClick={() => performAction(user, "approve")}
          >
            {isProcessing ? "Please wait..." : "Approve"}
          </button>

          <button
            type="button"
            className="manage-users-reject"
            disabled={Boolean(processing)}
            onClick={() => performAction(user, "reject")}
          >
            Reject
          </button>
        </div>
      );
    }

    if (status === "Rejected") {
      return (
        <span className="manage-users-no-actions">Rejected</span>
      );
    }

    return (
      <div className="manage-users-actions">
        {user.isActive ? (
          <button
            type="button"
            className="manage-users-deactivate"
            disabled={Boolean(processing)}
            onClick={() => performAction(user, "deactivate")}
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            className="manage-users-approve"
            disabled={Boolean(processing)}
            onClick={() => performAction(user, "reactivate")}
          >
            Reactivate
          </button>
        )}

        <button
          type="button"
          className="manage-users-delete"
          disabled={Boolean(processing)}
          onClick={() => performAction(user, "delete")}
        >
          Delete
        </button>
      </div>
    );
  };

  const getStatusClass = (status) =>
    `manage-users-status ${status.toLowerCase()}`;

  // Primary Manager restriction
  if (!isPrimaryManager) {
    return (
      <div className="manage-users-page">
        <div className="manage-users-message warning">
          Only the Primary Manager can manage user accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="manage-users-page">
      <div className="manage-users-heading">
        

      
      </div>

      {error && (
        <div className="manage-users-message error">
          {error}
        </div>
      )}

      {success && (
        <div className="manage-users-message success">
          {success}
        </div>
      )}

      <div className="manage-users-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={
              activeFilter === filter
                ? "manage-users-filter active"
                : "manage-users-filter"
            }
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
            <span>{counts[filter]}</span>
          </button>
        ))}
      </div>

      <div className="manage-users-table-container">
        {loading ? (
          <div className="manage-users-empty">
            Loading user accounts...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="manage-users-empty">
            <div className="manage-users-empty-icon">👥</div>
            <h3>No users found</h3>
            <p>
              There are no accounts in this category.
            </p>
          </div>
        ) : (
          <table className="manage-users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Account Type</th>
                <th>Status</th>
                <th>Date Registered</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const status = getStatus(user);

                return (
                  <tr
                    key={`${user.accountType}-${user.id}`}
                  >
                    <td>
                      <div className="manage-users-username">
                        {user.username}

                        {user.isPrimary && (
                          <span className="manage-users-primary">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>

                    <td>{user.accountType}</td>

                    <td>
                      <span className={getStatusClass(status)}>
                        {status}
                      </span>
                    </td>

                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>{renderActions(user)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="manage-users-note">
        <strong>Note:</strong> Deleting an account is a soft delete.
        Existing sales, returns and other transaction records are preserved.
      </div>
    </div>
  );
}
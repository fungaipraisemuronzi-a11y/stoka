
import { useState } from "react";
import "./ManageUsers.css";

export default function ManageUsers({ business }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Pending", "Approved"];

  return (
    <div className="manage-users-page">
      <div className="manage-users-heading">
        <div>
          <h2>Manage Users</h2>
          <p>Manage access to your business workspace.</p>
        </div>
        <span className="manage-users-business">
          {business?.businessName || business?.name || "Business"}
        </span>
      </div>

      <section className="manage-users-info">
        <div className="manage-users-info-icon">👥</div>
        <div>
          <h3>User access management</h3>
          <p>
            This section will allow you to review applications from tellers
            and managers before giving them permission to use your business
            workspace.
          </p>
        </div>
      </section>

      <section className="manage-users-card">
        <div className="manage-users-card-heading">
          <div>
            <h3>Users</h3>
            <p>Review and manage your business users.</p>
          </div>
        </div>

        <div className="manage-users-filters">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter}
              className={
                activeFilter === filter
                  ? "manage-users-filter active"
                  : "manage-users-filter"
              }
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="manage-users-empty">
          <span>👤</span>
          <h3>No users to display yet</h3>
          <p>
            User applications and approval requests will appear here
            when the user registration system is implemented.
          </p>
        </div>
      </section>
    </div>
  );
}

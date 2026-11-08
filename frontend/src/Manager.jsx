
import { useState } from "react";

import Stock from "./Stock";
import AddStock from "./AddStock";
import IE from "./IE";
import TellerHistory from "./TellerHistory";
import Reports from "./Reports";
import ManagerLogin from "./ManagerLogin";

import BusinessProfile from "./BusinessProfile";
import ManageUsers from "./ManageUsers";
import Subscribe from "./Subscribe";
import Feedback from "./Feedback";

import "./Stock.css";
import "./Manager.css";

const menuItems = [
  { id: "Stock", label: "Stock Setup", icon: "📦" },
  { id: "Purchases", label: "Purchases", icon: "🧾" },
  { id: "IE", label: "Income and Expenses", icon: "💰" },
  { id: "Tellers", label: "Tellers", icon: "👥" },
  { id: "Reports", label: "Reports", icon: "📊" },
];

const profileItems = [
  { id: "BusinessProfile", label: "Business Profile", icon: "🏢" },
  { id: "ManageUsers", label: "Manage Users", icon: "👥" },
  { id: "Subscribe", label: "Subscribe", icon: "💳" },
  { id: "Feedback", label: "Feedback", icon: "💬" },
];

const profileTitles = {
  BusinessProfile: "Business Profile",
  ManageUsers: "Manage Users",
  Subscribe: "Subscribe",
  Feedback: "Feedback",
};

export default function Manager({ business, onBack }) {
  const [currentBusiness, setCurrentBusiness] = useState(business);

  const businessId = currentBusiness?.id;

  const sessionStorageKey = businessId
    ? `stoka_manager_session_${businessId}`
    : null;

  const [managerSession, setManagerSession] = useState(() => {
    if (!businessId || !sessionStorageKey) return null;

    try {
      const saved = localStorage.getItem(sessionStorageKey);

      if (!saved) return null;

      const parsed = JSON.parse(saved);

      if (
        parsed?.manager?.businessId === businessId &&
        parsed?.token &&
        parsed?.manager
      ) {
        return parsed;
      }

      localStorage.removeItem(sessionStorageKey);
      return null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState("Stock");
  const [activeProfilePage, setActiveProfilePage] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const unlocked = Boolean(managerSession?.token && managerSession?.manager);

  const manager = managerSession?.manager || null;
  const managerToken = managerSession?.token || "";

  const businessName =
    currentBusiness?.businessName ||
    currentBusiness?.business_name ||
    currentBusiness?.name ||
    "Business";

  const handleManagerLogin = (session) => {
    if (!session?.token || !session?.manager) {
      return;
    }

    setManagerSession(session);

    if (sessionStorageKey) {
      localStorage.setItem(
        sessionStorageKey,
        JSON.stringify(session)
      );
    }

    setActiveTab("Stock");
    setActiveProfilePage(null);
    setMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleLogout = () => {
    if (sessionStorageKey) {
      localStorage.removeItem(sessionStorageKey);
    }

    setManagerSession(null);
    setActiveTab("Stock");
    setActiveProfilePage(null);
    setMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleMenuSelect = (itemId) => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
    setActiveProfilePage(null);

    if (itemId === "Logout") {
      handleLogout();
      return;
    }

    setActiveTab(itemId);
  };

  const handleProfileSelect = (pageId) => {
    setActiveProfilePage(pageId);
    setProfileMenuOpen(false);
    setMenuOpen(false);
  };

  const handleBusinessUpdated = (updatedBusiness) => {
    setCurrentBusiness(updatedBusiness);

    localStorage.setItem(
      "stoka_business",
      JSON.stringify(updatedBusiness)
    );
  };

  const handleHomeClick = () => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
    onBack?.();
  };

  const renderHeader = () => (
    <header className="stoka-manager-header">
      <div className="stoka-manager-brand">
        <span className="stoka-manager-brand-name">YoStoka</span>
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
          onClick={() => {
            setMenuOpen((previous) => !previous);
            setProfileMenuOpen(false);
          }}
        >
          ⋮
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="stoka-manager-menu-backdrop"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
                setProfileMenuOpen(false);
              }}
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
                    !activeProfilePage && activeTab === item.id
                      ? "stoka-manager-menu-item active"
                      : "stoka-manager-menu-item"
                  }
                  onClick={() => handleMenuSelect(item.id)}
                >
                  <span>{item.icon} {item.label}</span>
                  <span className="stoka-manager-menu-arrow">›</span>
                </button>
              ))}

              <div className="stoka-manager-menu-divider" />

              <button
                type="button"
                className={
                  activeProfilePage || profileMenuOpen
                    ? "stoka-manager-menu-item active"
                    : "stoka-manager-menu-item"
                }
                onClick={() =>
                  setProfileMenuOpen((previous) => !previous)
                }
              >
                <span>👤 Profile</span>
                <span className="stoka-manager-menu-arrow">
                  {profileMenuOpen ? "⌄" : "›"}
                </span>
              </button>

              {profileMenuOpen && (
                <div className="stoka-manager-profile-submenu">
                  {profileItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        activeProfilePage === item.id
                          ? "stoka-manager-menu-item active"
                          : "stoka-manager-menu-item"
                      }
                      onClick={() => handleProfileSelect(item.id)}
                    >
                      <span>{item.icon} {item.label}</span>
                      <span className="stoka-manager-menu-arrow">›</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="stoka-manager-menu-divider" />

              <button
                type="button"
                className="stoka-manager-menu-item stoka-manager-home-item"
                onClick={handleHomeClick}
              >
                <span>🏠 Back to Home</span>
              </button>

              <button
                type="button"
                className="stoka-manager-menu-item"
                onClick={() => handleMenuSelect("Logout")}
              >
                <span>🚪 Logout</span>
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
        business={currentBusiness}
        onBack={onBack}
        onLogin={handleManagerLogin}
      />
    );
  }

  return (
    <main className="stoka-manager-page">
      {renderHeader()}

      <section className="stoka-manager-workspace">
        {activeProfilePage ? (
          <section className="manager-selected-section">
            <div className="manager-content">
              <div className="manager-profile-page-heading">
                <div>
                  <button
                    type="button"
                    className="manager-profile-back-button"
                    onClick={() => setActiveProfilePage(null)}
                  >
                    ← Back to Manager
                  </button>

                  <h2>{profileTitles[activeProfilePage]}</h2>
                </div>
              </div>

              {activeProfilePage === "BusinessProfile" && (
                <BusinessProfile
                  business={currentBusiness}
                  onBusinessUpdated={handleBusinessUpdated}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeProfilePage === "ManageUsers" && (
                <ManageUsers
                  business={currentBusiness}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeProfilePage === "Subscribe" && (
                <Subscribe />
              )}

              {activeProfilePage === "Feedback" && (
                <Feedback
                  business={currentBusiness}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}
            </div>
          </section>
        ) : (
          <section className="manager-selected-section">
            <div className="manager-content">
              {activeTab === "Stock" && (
                <Stock
                  business={currentBusiness}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeTab === "Purchases" && (
                <AddStock
                  business={currentBusiness}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeTab === "IE" && (
                <IE
                  business={currentBusiness}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeTab === "Tellers" && (
                <TellerHistory
                  businessId={businessId}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}

              {activeTab === "Reports" && (
                <Reports
                  business={currentBusiness}
                  businessId={businessId}
                  manager={manager}
                  managerToken={managerToken}
                />
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

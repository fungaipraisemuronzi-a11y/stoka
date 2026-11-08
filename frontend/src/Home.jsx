
import { useState } from "react";
import Manager from "./Manager";
import Sales from "./Sales";
import Teller from "./Teller";
import ChangePassword from "./ChangePassword";
import "./Home.css";

export default function Home({ business, onLogout }) {
  const [selectedArea, setSelectedArea] = useState(null);

  const [activeTeller, setActiveTeller] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("stoka_teller")
      );

      return saved?.businessId === business.id
        ? saved
        : null;
    } catch {
      return null;
    }
  });

  function openTellerLogin() {
    setActiveTeller(null);
    localStorage.removeItem("stoka_teller");
    setSelectedArea("TellerLogin");
  }

  function handleTellerLogin(teller) {
    setActiveTeller(teller);
    setSelectedArea("TellerWorkspace");
  }

  function handleTellerLogout() {
    localStorage.removeItem("stoka_teller");
    setActiveTeller(null);
    setSelectedArea("TellerLogin");
  }

  function openManager() {
    setSelectedArea("Manager");
  }

  function openChangePassword() {
    setSelectedArea("ChangePassword");
  }

  function returnToSales() {
    setSelectedArea("TellerWorkspace");
  }

  function handleLogout() {
    onLogout();
  }

  if (selectedArea === "Manager") {
    return (
      <Manager
        business={business}
        onBack={() => setSelectedArea(null)}
      />
    );
  }

  if (selectedArea === "TellerLogin") {
    return (
      <Teller
        business={business}
        onBack={() => setSelectedArea(null)}
        onLogin={handleTellerLogin}
      />
    );
  }

  if (
    selectedArea === "ChangePassword" &&
    activeTeller
  ) {
    return (
      <ChangePassword
        business={business}
        tellerId={activeTeller.id}
        tellerName={activeTeller.name}
        onBack={returnToSales}
      />
    );
  }

  if (
    selectedArea === "TellerWorkspace" &&
    activeTeller
  ) {
    return (
      <Sales
        business={business}
        tellerId={activeTeller.id}
        tellerName={activeTeller.name}
        onBack={handleTellerLogout}
        onChangePassword={openChangePassword}
      />
    );
  }

  if (selectedArea) {
    return (
      <main className="app-container">
        <header className="top-bar">
          <button
            className="back-button"
            onClick={() => setSelectedArea(null)}
          >
            Back to Home
          </button>

          <div className="small-brand">
            <span>Stoka</span>
          </div>
        </header>

        <section className="placeholder-card">
          <h1>{selectedArea}</h1>

          <p className="placeholder-description">
            This workspace is not available yet.
          </p>

          <button
            className="primary-button"
            onClick={() => setSelectedArea(null)}
          >
            Return to Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <section className="welcome-banner">
          <div className="small-brand">
            <strong>Stoka</strong>
          </div>

          <div className="welcome-text">
            <h1>{business.businessName}</h1>
          </div>

          <button
            type="button"
            className="logout-power-button"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
          >
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v10" />
              <path d="M5.5 5.5a9 9 0 1 0 13 0" />
            </svg>
          </button>
        </section>
      </header>

      <a
        href="https://github.com/fungaipraisemuronzi-a11y/stoka/releases/download/Stoka/stokaandroid.zip"
        className="download-button"
      >
        Download Stoka Android for Teller functions
      </a>

      <section className="workspace-section">
        <div className="workspace-grid">
          <button
            className="workspace-card teller-card"
            onClick={openTellerLogin}
          >
            <div className="workspace-card-top" />

            <div className="workspace-card-text">
              <h3>Teller</h3>
              <p>
                Log in to teller account or create
                a new teller.
              </p>
            </div>
          </button>

          <button
            className="workspace-card manager-card"
            onClick={openManager}
          >
            <div className="workspace-card-top" />

            <div className="workspace-card-text">
              <h3>Manager</h3>
              <p>
                Stock, I&E, tellers and reports
              </p>
            </div>
          </button>
        </div>
      </section>

      <p>Business Id: {business.id}</p>
    </main>
  );
}

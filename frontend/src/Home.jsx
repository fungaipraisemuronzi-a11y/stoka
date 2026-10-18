import { useState } from "react";
import Manager from "./Manager";
import Sales from "./Sales";
import Teller from "./Teller";
import ChangePassword from "./ChangePassword";
import "./App.css";

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

  function openChangePassword() {
    setSelectedArea("ChangePassword");
  }

  function returnToSales() {
    setSelectedArea("TellerWorkspace");
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
            ← Back to Home
          </button>

          <div className="small-brand">
            <span className="brand-icon small-icon">
              S
            </span>
            <span>Stoka</span>
          </div>
        </header>

        <section className="placeholder-card">
          <div className="placeholder-icon">🛒</div>

          <p className="eyebrow">
            STOKA WORKSPACE
          </p>

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
        <div className="small-brand">
          
            <strong>Stoka</strong>
        
        </div>

        <button
          className="logout-button"
          onClick={onLogout}
        >
          <span>↪</span> Logout
        </button>
      </header>

      <section className="welcome-banner">
        <div>
          <h1>{business.businessName}</h1>

          <p className="welcome-description">
            Welcome back!
          </p>
        </div>
      </section>
      <a
        href="https://github.com/fungaipraisemuronzi-a11y/stoka/releases/download/Stoka/stokaandroid.zip"
        className="download-button"
        >Download Stoka Android for Teller functions</a>

      <section className="workspace-section">
        

        <div className="workspace-grid">
          <button
            className="workspace-card teller-card"
            onClick={openTellerLogin}
          >
            <div className="workspace-card-top">
            </div>

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
            onClick={() => setSelectedArea("Manager")}
          >
            <div className="workspace-card-top">
            </div>

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
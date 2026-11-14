
import { useState } from "react";
import Home from "./Home";
import "./BusinessLogin.css";

const API_URL = "https://stoka-of78.onrender.com";

const emptyForm = {
  businessName: "",
  location: "",
  phone: "",
  username: "",
  password: "",
  confirmPassword: "",
};

export default function App() {
  const [page, setPage] = useState("cover");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [business, setBusiness] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("stoka_business")
      ) || null;
    } catch {
      return null;
    }
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "username"
          ? value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15).toLowerCase()
          : name === "password" || name === "confirmPassword"
            ? value.slice(0, 15)
            : name === "businessName" || name === "location"
              ? value.slice(0, 25)
              : name === "phone"
                ? value.slice(0, 12)
                : value,
    }));
  }

  function switchPage(nextPage) {
    setPage(nextPage);
    setMessage("");
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const isRegister = page === "register";

    if (isRegister) {
      if (!/^[a-zA-Z0-9]+$/.test(form.username.trim())) {
        setMessage(
          "Username must contain letters and numbers only."
        );
        setLoading(false);
        return;
      }

      if (form.password !== form.confirmPassword) {
        setMessage("Passwords do not match.");
        setLoading(false);
        return;
      }

      if (!form.password || form.password.length > 15) {
        setMessage(
          "Password must contain between 1 and 15 characters."
        );
        setLoading(false);
        return;
      }
    }

    const endpoint = isRegister
      ? "/api/auth/register"
      : "/api/auth/login";

    const payload = isRegister
      ? {
          businessName: form.businessName.trim(),
          location: form.location.trim(),
          phone: form.phone.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          confirmPassword: form.confirmPassword,
        }
      : {
          username: form.username.trim().toLowerCase(),
          password: form.password,
        };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      localStorage.setItem(
        "stoka_business",
        JSON.stringify(data.business)
      );

      setBusiness(data.business);
      setForm(emptyForm);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("stoka_business");
    setBusiness(null);
    setForm(emptyForm);
    setPage("cover");
    setMessage("");
  }

  // Existing authenticated home
  if (business) {
    return (
      <Home
        business={business}
        onLogout={logout}
      />
    );
  }

  // PUBLIC COVER PAGE
  if (page === "cover") {
    return (
      <main className="cover-page">

        {/* HEADER */}
        <header className="cover-header">
          <div
            className="cover-logo"
            onClick={() => switchPage("cover")}
          >
            <div className="logo-icon">
              <span>🛒</span>
            </div>

            <div>
              <h1>YoStoka</h1>
              <p>Stock Made Easy</p>
            </div>
          </div>

          <nav className="cover-nav">
            <button
              className="cover-login"
              onClick={() => switchPage("login")}
            >
              Login
            </button>

            <button
              className="cover-register"
              onClick={() => switchPage("register")}
            >
              Create Account
            </button>
          </nav>
        </header>

        {/* HERO */}
        <section className="cover-hero">

          <div className="hero-content">
            <span className="hero-label">
              SMART BUSINESS MANAGEMENT
            </span>

            <h2>
              Smarter Stock Management
              <span> for Your Business</span>
            </h2>

            <p>
              YoStoka is a powerful and easy-to-use stock
              management system that helps you sell, track
              and grow your business efficiently.
            </p>

            <div className="hero-actions">
              <button
                className="cover-register hero-button"
                onClick={() => switchPage("register")}
              >
                Get Started
              </button>

              <button
                className="cover-login hero-button"
                onClick={() => switchPage("login")}
              >
                Sign In
              </button>
            </div>

            <div className="hero-benefits">
              <div>✓ Fast & Reliable</div>
              <div>✓ Secure & Trusted</div>
              <div>✓ Grow Your Business</div>
            </div>
          </div>

          <div className="hero-decoration">
            <div className="hero-circle">
              <div className="hero-circle-inner">
                <span className="hero-cart">▦</span>
                <h3>YoStoka</h3>
                <p>Manage. Sell. Grow.</p>

                <div className="hero-bars">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* FEATURES */}
        <section className="cover-features">

          <div className="feature-card">
            <div className="feature-heading">
              <span>🛒</span>
              <h3>Teller Functions</h3>
            </div>

            <p>
              Simple selling tools accessible from any device.
            </p>

            <ul>
              <li>Sell using a phone, tablet or laptop</li>
              <li>Record and track sales</li>
              <li>Process customer returns</li>
              <li>Record stock withdrawals</li>
            </ul>
          </div>

          <div className="feature-card">
            <div className="feature-heading">
              <span>⚙</span>
              <h3>Manager Functions</h3>
            </div>

            <p>
              Powerful management tools for your business.
            </p>

            <ul>
              <li>Manage stock, incomes and expenses</li>
              <li>View sales history and remaining stock</li>
              <li>View profit and loss reports</li>
              <li>Manage system users</li>
            </ul>
          </div>

        </section>

        {/* SUPPORT */}
        <section className="cover-support">
          <div className="support-icon">☎</div>

          <div className="support-content">
            <h2>Ongoing Support</h2>

            <p>
              We are here to help! Contact us on WhatsApp
              and receive assistance whenever you need it.
            </p>
          </div>

          <a
            href="https://wa.me/263YOURNUMBER"
            target="_blank"
            rel="noopener noreferrer"
            className="whatsapp-button"
          >
            Contact Us on WhatsApp →
          </a>
        </section>

        {/* FOOTER */}
        <footer className="cover-footer">
          <h2>YoStoka</h2>
          <p>Manage. Sell. Grow.</p>
          <span>Stock Management System</span>
          <small>© {new Date().getFullYear()} YoStoka. All rights reserved.</small>
        </footer>

      </main>
    );
  }

  // LOGIN AND REGISTRATION
  return (
    <main className="app-container auth-background">

      <section className="auth-card">

        <button
          type="button"
          className="back-to-cover"
          onClick={() => switchPage("cover")}
        >
          ← Back to Home
        </button>

        <div className="auth-heading">
          <label>
            {page === "login"
              ? "YoStoka Sign In"
              : "YoStoka Business Register"}
          </label>
        </div>

        <div className="auth-switch">
          <button
            type="button"
            className={page === "login" ? "active" : ""}
            onClick={() => switchPage("login")}
          >
            Login
          </button>

          <button
            type="button"
            className={page === "register" ? "active" : ""}
            onClick={() => switchPage("register")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {page === "register" && (
            <>
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                placeholder="Enter business name"
                maxLength={25}
                required
              />

              <label htmlFor="location">Business location</label>
              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Enter location"
                maxLength={25}
                required
              />

              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                maxLength={12}
                required
              />
            </>
          )}

          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Letters and numbers only"
            autoComplete="username"
            maxLength={15}
            pattern="[a-zA-Z0-9]+"
            title="Use letters and numbers only."
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter password"
            autoComplete={
              page === "login"
                ? "current-password"
                : "new-password"
            }
            maxLength={15}
            required
          />

          {page === "register" && (
            <>
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                autoComplete="new-password"
                maxLength={15}
                required
              />
            </>
          )}

          <button
            className="submit-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : page === "login"
                ? "Login"
                : "Create account"}
          </button>

        </form>

        {message && (
          <p className="message" role="alert">
            {message}
          </p>
        )}

      </section>
    </main>
  );
}

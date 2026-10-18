
import { useState } from "react";
import Home from "./Home";
import "./App.css";

const API_URL = "https://stoka-of78.onrender.com";

const emptyForm = {
  businessName: "",
  location: "",
  phone: "",
  username: "",
  password: "",
};

export default function App() {
  const [page, setPage] = useState("login");
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
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
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

    const endpoint = isRegister
      ? "/api/auth/register"
      : "/api/auth/login";

    const payload = isRegister
      ? form
      : {
          username: form.username,
          password: form.password,
        };

    try {
      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Request failed."
        );
      }

      localStorage.setItem(
        "stoka_business",
        JSON.stringify(data.business)
      );

      setBusiness(data.business);
      setForm(emptyForm);
      setMessage("");
    } catch (error) {
      setMessage(
        `${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("stoka_business");
    setBusiness(null);
    setForm(emptyForm);
    setPage("login");
    setMessage("");
  }

  if (business) {
    return (
      <Home
        business={business}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="app-container auth-background">
      <section className="auth-card">
        <div className="brand">
          <h1 color="black">Stoka</h1>
        </div>

        <div className="auth-heading">
          <h2 color="black">
            {page === "login"
              ? "Welcome back"
              : "Create your account"}
          </h2>

          <p>
            {page === "login"
              ? "Sign in to manage your business."
              : "Register your business to get started."}
          </p>
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
              <label htmlFor="businessName">
                Business name
              </label>

              <input
                id="businessName"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                placeholder="Enter business name"
                required
              />

              <label htmlFor="location">
                Business location
              </label>

              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Enter location"
                required
              />

              <label htmlFor="phone">
                Phone number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
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
            placeholder="Enter username"
            autoComplete="username"
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
            required
          />

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

        <p className="footer-text">
          Stoka — stock management made simple.
        </p>
      </section>
    </main>
  );
}
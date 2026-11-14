
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
      setMessage(error.message);
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

        <div className="auth-heading">
          <label>
            {page === "login"
              ? "Stoka Sign in"
              : "Stoka Business Register"}
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
              <label htmlFor="businessName">
                Business name
              </label>

              <input
                id="businessName"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                placeholder="Enter business name"
                maxLength={25}
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
                maxLength={25}
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
                maxLength={12}
                required
              />
            </>
          )}

          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Letters and numbers only"
            autoComplete="username"
            maxLength={15}
            pattern="[a-zA-Z0-9]+"
            title="Use letters and numbers only. No spaces or special characters."
            required
          />

          <label htmlFor="password">
            Password
          </label>

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

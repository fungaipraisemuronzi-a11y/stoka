
import { useState } from "react";
import "./Feedback.css";

const API_URL = "https://stoka-of78.onrender.com";
const WHATSAPP_NUMBER = "263777847204";

export default function Feedback({ business }) {
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    const trimmedFeedback = feedbackText.trim();

    if (!business?.id) {
      setError("Business information is missing. Please log in again.");
      return;
    }

    if (!trimmedFeedback) {
      setError("Please enter your feedback.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: business.id,
          message: trimmedFeedback,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not submit feedback.");
      }

      setFeedbackText("");
      setMessage(data.message || "Thank you for your feedback.");
    } catch (err) {
      setError(err.message || "Could not submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-page">
      <div className="feedback-heading">
        <h2>Feedback</h2>
        <p>Help us improve Stoka by sharing your experience.</p>
      </div>

      <section className="feedback-card">
        <div className="feedback-card-heading">
          <span className="feedback-icon">💬</span>
          <div>
            <h3>Send us feedback</h3>
            <p>Tell us about a problem, suggestion or improvement.</p>
          </div>
        </div>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="stoka-feedback">Your feedback</label>

            <textarea
              id="stoka-feedback"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Write your feedback here..."
              rows={8}
              maxLength={3000}
              required
            />

            <small>{feedbackText.length}/3000 characters</small>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </section>

      <section className="feedback-card feedback-contact-card">
        <h3>Need immediate assistance?</h3>
        <p>Contact the Stoka support team directly on WhatsApp.</p>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            "Hello, I need assistance with Stoka."
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-button"
        >
          WhatsApp Us
        </a>
      </section>
    </div>
  );
}

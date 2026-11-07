
import "./Subscribe.css";

const WHATSAPP_NUMBER = "263777847204";
const SUBSCRIBE_CODE = "*151*1*1*0777847204*6#";

export default function Subscribe() {
  return (
    <div className="subscribe-page">
      <div className="subscribe-heading">
        <h2>Stoka Subscription</h2>
        <p>Manage your Stoka subscription and get assistance.</p>
      </div>

      <section className="subscribe-card">
        <div className="subscribe-icon">💳</div>

        <h3>Subscribe to Stoka</h3>

        <p>
          Follow the USSD instructions on your phone to make your
          subscription payment.
        </p>

        <a href={`tel:${SUBSCRIBE_CODE}`} className="primary-button">
          Subscribe Now
        </a>

        <div className="subscribe-note">
          Subscription activation is currently handled manually.
          After completing the phone prompts, contact Stoka to confirm
          your subscription.
        </div>
      </section>

      <section className="subscribe-card subscribe-help-card">
        <div className="subscribe-icon">💬</div>

        <h3>Need subscription assistance?</h3>

        <p>
          Contact our support team on WhatsApp if you need help
          with payments or subscription activation.
        </p>

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            "Hello, I need assistance with my Stoka subscription."
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-button"
        >
          WhatsApp Support
        </a>
      </section>
    </div>
  );
}

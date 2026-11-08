
import "./Subscribe.css";

const WHATSAPP_NUMBER = "263777847204";
const SUBSCRIBE_CODE = "*151*1*1*0777847204*6#";

export default function Subscribe() {
  return (
    <div className="subscribe-page">
     

      <section className="subscribe-card">
       

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
          After completing the phone prompts, contact YoStoka to confirm
          your subscription.
        </div>
      </section>

      
    </div>
  );
}

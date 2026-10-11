import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// Submit feedback from a registered business
router.post("/", async (req, res) => {
  const { businessId, message } = req.body ?? {};

  if (
    typeof businessId !== "string" ||
    !businessId.trim() ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Business ID and feedback message are required.",
    });
  }

  if (message.trim().length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Feedback must not exceed 5000 characters.",
    });
  }

  try {
    const businessResult = await pool.query(
      `SELECT id, "businessName", "isActive"
       FROM "Business"
       WHERE id = $1
       LIMIT 1`,
      [businessId.trim()]
    );

    const business = businessResult.rows[0];

    if (!business || !business.isActive) {
      return res.status(403).json({
        success: false,
        message: "An active registered business is required to submit feedback.",
      });
    }

    const result = await pool.query(
      `INSERT INTO feedback (
         business_id,
         business_name,
         message
       )
       VALUES ($1, $2, $3)
       RETURNING id, business_id, business_name, message, created_at`,
      [
        business.id,
        business.businessName,
        message.trim(),
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully.",
      feedback: result.rows[0],
    });
  } catch (error) {
    console.error("Feedback submission error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit feedback.",
    });
  }
});

export default router;
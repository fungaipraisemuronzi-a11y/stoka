import express from "express";
import pool from "../config/database.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

router.use(adminAuth);

// List all feedback, newest first
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         business_id,
         business_name,
         message,
         created_at
       FROM feedback
       ORDER BY created_at DESC, id DESC`
    );

    return res.json({
      success: true,
      feedback: result.rows,
    });
  } catch (error) {
    console.error("Admin feedback list error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load feedback.",
    });
  }
});

export default router;
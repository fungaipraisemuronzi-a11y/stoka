import express from "express";
import pool from "../config/database.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

// Protect every endpoint in this router
router.use(adminAuth);

// List registered businesses
router.get("/businesses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         "businessName",
         location,
         phone,
         "isActive",
         "createdAt"
       FROM "Business"
       ORDER BY "createdAt" DESC NULLS LAST, id ASC`
    );

    return res.json({
      success: true,
      businesses: result.rows,
    });
  } catch (error) {
    console.error("Admin business list error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load businesses.",
    });
  }
});

// Activate or deactivate a business
router.patch("/businesses/:id/status", async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body ?? {};

  if (typeof isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be true or false.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE "Business"
       SET "isActive" = $1
       WHERE id = $2
       RETURNING
         id,
         "businessName",
         location,
         phone,
         "isActive",
         "createdAt"`,
      [isActive, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Business not found.",
      });
    }

    return res.json({
      success: true,
      message: isActive
        ? "Business activated successfully."
        : "Business deactivated successfully.",
      business: result.rows[0],
    });
  } catch (error) {
    console.error("Business status update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update business status.",
    });
  }
});

export default router;
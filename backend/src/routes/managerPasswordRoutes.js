import express from "express";
import pool from "../config/database.js";

const router = express.Router();

function getBusinessId(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

// Check whether a manager password exists.
router.get("/status", async (req, res) => {
  try {
    const businessId = getBusinessId(req.query.businessId);

    if (!businessId) {
      return res.status(400).json({
        message: "Business ID is required.",
      });
    }

    const result = await pool.query(
      `SELECT 1
       FROM manager_passwords
       WHERE business_id = $1`,
      [businessId]
    );

    return res.json({
      exists: result.rowCount > 0,
    });
  } catch (error) {
    console.error("Manager password status error:", error);

    return res.status(500).json({
      message: "Could not check manager password status.",
    });
  }
});

// Create the first manager password.
router.post("/create", async (req, res) => {
  try {
    const businessId = getBusinessId(req.body.businessId);
    const { password } = req.body;

    if (
      !businessId ||
      typeof password !== "string" ||
      !password.trim()
    ) {
      return res.status(400).json({
        message: "Business ID and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters.",
      });
    }

    const result = await pool.query(
      `INSERT INTO manager_passwords
        (business_id, password)
       VALUES ($1, $2)
       ON CONFLICT (business_id) DO NOTHING
       RETURNING business_id`,
      [businessId, password]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        message:
          "A manager password already exists for this business.",
      });
    }

    return res.status(201).json({
      message: "Manager password created successfully.",
    });
  } catch (error) {
    console.error("Create manager password error:", error);

    return res.status(500).json({
      message: "Could not create manager password.",
    });
  }
});

// Verify the manager password.
router.post("/login", async (req, res) => {
  try {
    const businessId = getBusinessId(req.body.businessId);
    const { password } = req.body;

    if (
      !businessId ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Business ID and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT password
       FROM manager_passwords
       WHERE business_id = $1`,
      [businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Create a manager password first.",
      });
    }

    if (password !== result.rows[0].password) {
      return res.status(401).json({
        message: "Incorrect manager password.",
      });
    }

    return res.json({
      message: "Manager login successful.",
    });
  } catch (error) {
    console.error("Manager login error:", error);

    return res.status(500).json({
      message: "Could not verify manager password.",
    });
  }
});

// Change an existing manager password.
router.patch("/change", async (req, res) => {
  try {
    const businessId = getBusinessId(req.body.businessId);
    const { currentPassword, newPassword } = req.body;

    if (
      !businessId ||
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        message: "Please provide all required password details.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password must contain at least 6 characters.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message:
          "The new password must differ from the current password.",
      });
    }

    const result = await pool.query(
      `SELECT password
       FROM manager_passwords
       WHERE business_id = $1`,
      [businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "No manager password has been created yet.",
      });
    }

    if (currentPassword !== result.rows[0].password) {
      return res.status(401).json({
        message: "Current manager password is incorrect.",
      });
    }

    await pool.query(
      `UPDATE manager_passwords
       SET password = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE business_id = $2`,
      [newPassword, businessId]
    );

    return res.json({
      message: "Manager password changed successfully.",
    });
  } catch (error) {
    console.error("Change manager password error:", error);

    return res.status(500).json({
      message: "Could not change manager password.",
    });
  }
});

export default router;
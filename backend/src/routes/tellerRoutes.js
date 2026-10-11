
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// CREATE TELLER
router.post("/create", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business, teller name and password are required.",
      });
    }

    const result = await pool.query(
      `INSERT INTO "Teller"
        ("businessId", name, password)
       VALUES ($1, $2, $3)
       RETURNING id, "businessId", name, "isActive", "createdAt"`,
      [businessId, name.trim(), password]
    );

    return res.status(201).json({
      message: "Teller created successfully.",
      teller: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A teller with this name already exists in this business.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        message: "Business not found.",
      });
    }

    console.error("Create teller error:", error.message);

    return res.status(500).json({
      message: "Failed to create teller.",
    });
  }
});

// TELLER LOGIN
router.post("/login", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business, teller name and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, "businessId", name, password, "isActive"
       FROM "Teller"
       WHERE "businessId" = $1 AND name = $2
       LIMIT 1`,
      [businessId, name.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid teller name or password.",
      });
    }

    const teller = result.rows[0];

    if (teller.password !== password) {
      return res.status(401).json({
        message: "Invalid teller name or password.",
      });
    }

    if (!teller.isActive) {
      return res.status(403).json({
        message: "This teller account has been suspended.",
      });
    }

    return res.json({
      message: "Teller login successful.",
      teller: {
        id: teller.id,
        businessId: teller.businessId,
        name: teller.name,
      },
    });
  } catch (error) {
    console.error("Teller login error:", error.message);

    return res.status(500).json({
      message: "Teller login failed.",
    });
  }
});

// LIST TELLERS FOR A BUSINESS
router.get("/business/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;

    const result = await pool.query(
      `SELECT id, "businessId", name, "isActive", "createdAt"
       FROM "Teller"
       WHERE "businessId" = $1
       ORDER BY name ASC`,
      [businessId]
    );

    return res.json({ tellers: result.rows });
  } catch (error) {
    console.error("List tellers error:", error.message);

    return res.status(500).json({
      message: "Failed to load tellers.",
    });
  }
});

// SUSPEND OR REACTIVATE TELLER
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId, isActive } = req.body;

    if (!businessId || typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "Business ID and a valid active status are required.",
      });
    }

    const result = await pool.query(
      `UPDATE "Teller"
       SET "isActive" = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "businessId" = $3
       RETURNING id, "businessId", name, "isActive", "createdAt"`,
      [isActive, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Teller not found for this business.",
      });
    }

    return res.json({
      message: isActive
        ? "Teller reactivated successfully."
        : "Teller suspended successfully.",
      teller: result.rows[0],
    });
  } catch (error) {
    console.error("Update teller status error:", error.message);

    return res.status(500).json({
      message: "Failed to update teller status.",
    });
  }
});

// CHANGE TELLER PASSWORD
router.patch("/:id/change-password", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      businessId,
      currentPassword,
      newPassword,
    } = req.body;

    if (
      !businessId ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        message:
          "Business ID, current password and new password are required.",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        message:
          "New password must contain at least 4 characters.",
      });
    }

    const result = await pool.query(
      `SELECT id, password
       FROM "Teller"
       WHERE id = $1 AND "businessId" = $2
       LIMIT 1`,
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Teller not found for this business.",
      });
    }

    const teller = result.rows[0];

    if (teller.password !== currentPassword) {
      return res.status(401).json({
        message: "Current password is incorrect.",
      });
    }

    await pool.query(
      `UPDATE "Teller"
       SET password = $1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "businessId" = $3`,
      [newPassword, id, businessId]
    );

    return res.json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Change teller password error:",
      error.message
    );

    return res.status(500).json({
      message: "Failed to change teller password.",
    });
  }
});

export default router;


import express from "express";
import pool from "../config/database.js";
import { requireManager } from "../middleware/managerAuth.js";

const router = express.Router();

// CREATE TELLER REGISTRATION REQUEST
// New tellers must wait for Primary Manager approval.
router.post("/create", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business, teller username and password are required.",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        message: "Password must contain at least 4 characters.",
      });
    }

    const result = await pool.query(
      `INSERT INTO "Teller"
        (
          "businessId",
          name,
          password,
          "isActive",
          "approvalStatus",
          "requestedAt"
        )
       VALUES ($1, $2, $3, false, 'pending', CURRENT_TIMESTAMP)
       RETURNING
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus",
         "requestedAt"`,
      [businessId, name.trim(), password]
    );

    return res.status(201).json({
      message:
        "Registration request submitted. Please wait for the Primary Manager to approve your account.",
      teller: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A teller with this username already exists in this business.",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        message: "Business not found.",
      });
    }

    console.error("Create teller request error:", error);

    return res.status(500).json({
      message: "Failed to submit teller registration request.",
    });
  }
});

// TELLER LOGIN
router.post("/login", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business, teller username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         "businessId",
         name,
         password,
         "isActive",
         "approvalStatus"
       FROM "Teller"
       WHERE "businessId" = $1 AND name = $2
       LIMIT 1`,
      [businessId, name.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid teller username or password.",
      });
    }

    const teller = result.rows[0];

    if (teller.password !== password) {
      return res.status(401).json({
        message: "Invalid teller username or password.",
      });
    }

    if (teller.approvalStatus === "pending") {
      return res.status(403).json({
        message:
          "Your registration request is awaiting approval from the Primary Manager.",
        approvalStatus: "pending",
      });
    }

    if (teller.approvalStatus === "rejected") {
      return res.status(403).json({
        message:
          "Your teller registration request was rejected. Please contact the Primary Manager.",
        approvalStatus: "rejected",
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
    console.error("Teller login error:", error);

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
      `SELECT
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus",
         "requestedAt",
         "approvedAt",
         "approvedBy",
         "createdAt"
       FROM "Teller"
       WHERE "businessId" = $1
       ORDER BY
         CASE
           WHEN "approvalStatus" = 'pending' THEN 0
           ELSE 1
         END,
         name ASC`,
      [businessId]
    );

    return res.json({
      tellers: result.rows,
    });
  } catch (error) {
    console.error("List tellers error:", error);

    return res.status(500).json({
      message: "Failed to load tellers.",
    });
  }
});

// APPROVE TELLER REGISTRATION
// ONLY THE PRIMARY MANAGER CAN APPROVE.
router.patch("/:id/approve", requireManager, async (req, res) => {
  try {
    if (req.manager.isPrimary !== true) {
      return res.status(403).json({
        message: "Only the Primary Manager can approve teller registrations.",
      });
    }

    const { id } = req.params;
    const businessId = req.manager.businessId;
    const managerUsername = req.manager.username;

    const result = await pool.query(
      `UPDATE "Teller"
       SET
         "approvalStatus" = 'approved',
         "isActive" = true,
         "approvedAt" = CURRENT_TIMESTAMP,
         "approvedBy" = $1,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE
         id = $2
         AND "businessId" = $3
         AND "approvalStatus" = 'pending'
       RETURNING
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus",
         "approvedAt",
         "approvedBy"`,
      [managerUsername, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Pending teller request not found for this business.",
      });
    }

    return res.json({
      message: "Teller registration approved successfully.",
      teller: result.rows[0],
    });
  } catch (error) {
    console.error("Approve teller error:", error);

    return res.status(500).json({
      message: "Failed to approve teller registration.",
    });
  }
});

// REJECT TELLER REGISTRATION
// ONLY THE PRIMARY MANAGER CAN REJECT.
router.patch("/:id/reject", requireManager, async (req, res) => {
  try {
    if (req.manager.isPrimary !== true) {
      return res.status(403).json({
        message: "Only the Primary Manager can reject teller registrations.",
      });
    }

    const { id } = req.params;
    const businessId = req.manager.businessId;

    const result = await pool.query(
      `UPDATE "Teller"
       SET
         "approvalStatus" = 'rejected',
         "isActive" = false,
         "approvedAt" = NULL,
         "approvedBy" = NULL,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE
         id = $1
         AND "businessId" = $2
         AND "approvalStatus" = 'pending'
       RETURNING
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus"`,
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Pending teller request not found for this business.",
      });
    }

    return res.json({
      message: "Teller registration rejected.",
      teller: result.rows[0],
    });
  } catch (error) {
    console.error("Reject teller error:", error);

    return res.status(500).json({
      message: "Failed to reject teller registration.",
    });
  }
});

// SUSPEND OR REACTIVATE AN APPROVED TELLER
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
       SET
         "isActive" = $1,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE
         id = $2
         AND "businessId" = $3
         AND "approvalStatus" = 'approved'
       RETURNING
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus",
         "createdAt"`,
      [isActive, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Approved teller not found for this business.",
      });
    }

    return res.json({
      message: isActive
        ? "Teller reactivated successfully."
        : "Teller suspended successfully.",
      teller: result.rows[0],
    });
  } catch (error) {
    console.error("Update teller status error:", error);

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

    if (!businessId || !currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Business ID, current password and new password are required.",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        message: "New password must contain at least 4 characters.",
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
       SET
         password = $1,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "businessId" = $3`,
      [newPassword, id, businessId]
    );

    return res.json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change teller password error:", error);

    return res.status(500).json({
      message: "Failed to change teller password.",
    });
  }
});

export default router;


import express from "express";
import pool from "../config/database.js";
import { requireManager, requirePrimaryManager } from "../middleware/managerAuth.js";

const router = express.Router();

// --------------------------------------------------
// HELPER: WRITE MANAGER AUDIT LOG
// --------------------------------------------------
async function writeAuditLog(manager, teller, action, beforeData, afterData) {
  const businessId = manager.businessId ?? manager.business_id;
  const managerNumber = manager.managerNumber ?? manager.manager_number;

  if (!businessId || !manager.id || !manager.username) {
    throw new Error("Manager audit information is incomplete.");
  }

  await pool.query(
    `INSERT INTO manager_audit_logs
      (
        business_id,
        manager_id,
        manager_username,
        manager_number,
        entity_type,
        record_id,
        action,
        before_data,
        after_data
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      businessId,
      manager.id,
      manager.username,
      managerNumber ?? null,
      "teller",
      teller.id,
      action,
      JSON.stringify(beforeData ?? {}),
      JSON.stringify(afterData ?? {}),
    ]
  );
}

// --------------------------------------------------
// CREATE TELLER REGISTRATION REQUEST
// Public: teller submits a request for approval
// --------------------------------------------------
router.post("/create", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business ID, username and password are required.",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        message: "Password must be at least 4 characters.",
      });
    }

    const business = await pool.query(
      `SELECT id
       FROM "Business"
       WHERE id = $1 AND "isActive" = TRUE`,
      [businessId]
    );

    if (!business.rows.length) {
      return res.status(404).json({
        message: "Business not found or inactive.",
      });
    }

    const existing = await pool.query(
      `SELECT id
       FROM "Teller"
       WHERE "businessId" = $1
       AND LOWER(name) = LOWER($2)`,
      [businessId, name.trim()]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        message: "This username is already registered.",
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
          "requestedAt",
          "isDeleted"
        )
       VALUES ($1, $2, $3, FALSE, 'pending', CURRENT_TIMESTAMP, FALSE)
       RETURNING
         id,
         "businessId",
         name,
         "isActive",
         "approvalStatus",
         "requestedAt"`,
      [businessId, name.trim(), password]
    );

    res.status(201).json({
      message: "Registration request submitted. Wait for Primary Manager approval.",
      teller: result.rows[0],
    });
  } catch (error) {
    console.error("Teller registration error:", error);
    res.status(500).json({
      message: "Failed to submit teller registration request.",
    });
  }
});

// --------------------------------------------------
// TELLER LOGIN
// --------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { businessId, name, password } = req.body;

    if (!businessId || !name?.trim() || !password) {
      return res.status(400).json({
        message: "Business ID, username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM "Teller"
       WHERE "businessId" = $1
       AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [businessId, name.trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const teller = result.rows[0];

    if (teller.isDeleted) {
      return res.status(403).json({
        message: "This teller account has been deleted.",
      });
    }

    if (teller.approvalStatus === "pending") {
      return res.status(403).json({
        message: "Your registration is waiting for Primary Manager approval.",
      });
    }

    if (teller.approvalStatus === "rejected") {
      return res.status(403).json({
        message: "Your registration request was rejected.",
      });
    }

    if (!teller.isActive) {
      return res.status(403).json({
        message: "Your teller account is inactive. Contact the Primary Manager.",
      });
    }

    if (teller.password !== password) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    res.json({
      message: "Login successful.",
      teller: {
        id: teller.id,
        businessId: teller.businessId,
        name: teller.name,
      },
    });
  } catch (error) {
    console.error("Teller login error:", error);
    res.status(500).json({
      message: "Teller login failed.",
    });
  }
});

// --------------------------------------------------
// GET TELLERS FOR A BUSINESS
// Any authenticated manager in the same business
// --------------------------------------------------
router.get(
  "/business/:businessId",
  requireManager,
  async (req, res) => {
    try {
      const { businessId } = req.params;

      if (req.manager.businessId !== businessId) {
        return res.status(403).json({
          message: "You cannot access another business's tellers.",
        });
      }

      const result = await pool.query(
        `SELECT
           id,
           "businessId",
           name,
           "isActive",
           "approvalStatus",
           "isDeleted",
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
           "createdAt" DESC`,
        [businessId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Get tellers error:", error);
      res.status(500).json({
        message: "Failed to load tellers.",
      });
    }
  }
);

// --------------------------------------------------
// APPROVE TELLER
// PRIMARY MANAGER ONLY
// --------------------------------------------------
router.patch(
  "/:id/approve",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.manager.businessId;

      const existing = await pool.query(
        `SELECT *
         FROM "Teller"
         WHERE id = $1 AND "businessId" = $2`,
        [id, businessId]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          message: "Teller not found.",
        });
      }

      const teller = existing.rows[0];

      if (teller.isDeleted) {
        return res.status(400).json({
          message: "Deleted teller accounts cannot be approved.",
        });
      }

      if (teller.approvalStatus !== "pending") {
        return res.status(400).json({
          message: "This teller request is not pending.",
        });
      }

      const result = await pool.query(
        `UPDATE "Teller"
         SET
           "approvalStatus" = 'approved',
           "isActive" = TRUE,
           "approvedAt" = CURRENT_TIMESTAMP,
           "approvedBy" = $1,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2 AND "businessId" = $3
         RETURNING id, name, "approvalStatus", "isActive"`,
        [req.manager.username, id, businessId]
      );

      await writeAuditLog(
        req.manager,
        teller,
        "approve",
        {
          approvalStatus: teller.approvalStatus,
          isActive: teller.isActive,
        },
        {
          approvalStatus: "approved",
          isActive: true,
        }
      );

      res.json({
        message: "Teller approved successfully.",
        teller: result.rows[0],
      });
    } catch (error) {
      console.error("Approve teller error:", error);
      res.status(500).json({
        message: "Failed to approve teller.",
      });
    }
  }
);

// --------------------------------------------------
// REJECT TELLER REQUEST
// PRIMARY MANAGER ONLY
// --------------------------------------------------
router.patch(
  "/:id/reject",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.manager.businessId;

      const existing = await pool.query(
        `SELECT *
         FROM "Teller"
         WHERE id = $1 AND "businessId" = $2`,
        [id, businessId]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          message: "Teller not found.",
        });
      }

      const teller = existing.rows[0];

      if (teller.isDeleted) {
        return res.status(400).json({
          message: "This teller account has been deleted.",
        });
      }

      if (teller.approvalStatus !== "pending") {
        return res.status(400).json({
          message: "Only pending requests can be rejected.",
        });
      }

      const result = await pool.query(
        `UPDATE "Teller"
         SET
           "approvalStatus" = 'rejected',
           "isActive" = FALSE,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND "businessId" = $2
         RETURNING id, name, "approvalStatus", "isActive"`,
        [id, businessId]
      );

      await writeAuditLog(
        req.manager,
        teller,
        "reject",
        {
          approvalStatus: teller.approvalStatus,
          isActive: teller.isActive,
        },
        {
          approvalStatus: "rejected",
          isActive: false,
        }
      );

      res.json({
        message: "Teller request rejected.",
        teller: result.rows[0],
      });
    } catch (error) {
      console.error("Reject teller error:", error);
      res.status(500).json({
        message: "Failed to reject teller request.",
      });
    }
  }
);

// --------------------------------------------------
// ACTIVATE / DEACTIVATE TELLER
// PRIMARY MANAGER ONLY
// --------------------------------------------------
router.patch(
  "/:id/status",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const businessId = req.manager.businessId;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          message: "isActive must be true or false.",
        });
      }

      const existing = await pool.query(
        `SELECT *
         FROM "Teller"
         WHERE id = $1 AND "businessId" = $2`,
        [id, businessId]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          message: "Teller not found.",
        });
      }

      const teller = existing.rows[0];

      if (teller.isDeleted) {
        return res.status(400).json({
          message: "Deleted teller accounts cannot be activated.",
        });
      }

      if (teller.approvalStatus !== "approved") {
        return res.status(400).json({
          message: "Only approved tellers can be activated or deactivated.",
        });
      }

      const result = await pool.query(
        `UPDATE "Teller"
         SET
           "isActive" = $1,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $2 AND "businessId" = $3
         RETURNING id, name, "approvalStatus", "isActive"`,
        [isActive, id, businessId]
      );

      await writeAuditLog(
        req.manager,
        teller,
        isActive ? "reactivate" : "deactivate",
        { isActive: teller.isActive },
        { isActive }
      );

      res.json({
        message: isActive
          ? "Teller account reactivated."
          : "Teller account deactivated.",
        teller: result.rows[0],
      });
    } catch (error) {
      console.error("Change teller status error:", error);
      res.status(500).json({
        message: "Failed to update teller status.",
      });
    }
  }
);

// --------------------------------------------------
// SOFT DELETE TELLER
// PRIMARY MANAGER ONLY
// Keeps historical sales and transactions
// --------------------------------------------------
router.delete(
  "/:id",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.manager.businessId;

      const existing = await pool.query(
        `SELECT *
         FROM "Teller"
         WHERE id = $1 AND "businessId" = $2`,
        [id, businessId]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          message: "Teller not found.",
        });
      }

      const teller = existing.rows[0];

      if (teller.isDeleted) {
        return res.status(400).json({
          message: "This teller has already been deleted.",
        });
      }

      const result = await pool.query(
        `UPDATE "Teller"
         SET
           "isDeleted" = TRUE,
           "isActive" = FALSE,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND "businessId" = $2
         RETURNING id, name, "isDeleted", "isActive"`,
        [id, businessId]
      );

      await writeAuditLog(
        req.manager,
        teller,
        "delete",
        {
          isDeleted: false,
          isActive: teller.isActive,
        },
        {
          isDeleted: true,
          isActive: false,
        }
      );

      res.json({
        message: "Teller account deleted. Transaction history has been preserved.",
        teller: result.rows[0],
      });
    } catch (error) {
      console.error("Delete teller error:", error);
      res.status(500).json({
        message: "Failed to delete teller.",
      });
    }
  }
);

// --------------------------------------------------
// CHANGE TELLER PASSWORD
// Teller changes their own password
// --------------------------------------------------
router.patch("/:id/change-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId, currentPassword, newPassword } = req.body;

    if (!businessId || !currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Business ID, current password and new password are required.",
      });
    }

    if (String(newPassword).length < 4) {
      return res.status(400).json({
        message: "New password must be at least 4 characters.",
      });
    }

    const existing = await pool.query(
      `SELECT *
       FROM "Teller"
       WHERE id = $1 AND "businessId" = $2`,
      [id, businessId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        message: "Teller not found.",
      });
    }

    const teller = existing.rows[0];

    if (teller.isDeleted || !teller.isActive || teller.approvalStatus !== "approved") {
      return res.status(403).json({
        message: "This teller account cannot change its password.",
      });
    }

    if (teller.password !== currentPassword) {
      return res.status(401).json({
        message: "Current password is incorrect.",
      });
    }

    await pool.query(
      `UPDATE "Teller"
       SET password = $1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $2 AND "businessId" = $3`,
      [newPassword, id, businessId]
    );

    res.json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change teller password error:", error);
    res.status(500).json({
      message: "Failed to change password.",
    });
  }
});

export default router;
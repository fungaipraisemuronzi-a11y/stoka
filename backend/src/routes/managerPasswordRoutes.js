
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

import {
  requireManager,
  requirePrimaryManager,
} from "../middleware/managerAuth.js";

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const MIN_PASSWORD_LENGTH = 6;

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

function validateManagerDetails(username, password) {
  if (
    !username ||
    username.length < 3 ||
    username.length > 50 ||
    !USERNAME_REGEX.test(username)
  ) {
    return "Username must be 3–50 characters and contain only letters and numbers.";
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

// --------------------------------------------------
// TOKEN
// --------------------------------------------------

function createManagerToken(manager) {
  if (!process.env.MANAGER_JWT_SECRET) {
    throw new Error(
      "MANAGER_JWT_SECRET is missing from the server environment."
    );
  }

  return jwt.sign(
    {
      managerId: manager.id,
      businessId: manager.business_id,
    },
    process.env.MANAGER_JWT_SECRET,
    { expiresIn: "12h" }
  );
}

// --------------------------------------------------
// PUBLIC MANAGER DATA
// --------------------------------------------------

function publicManager(manager) {
  return {
    id: manager.id,
    businessId: manager.business_id,
    managerNumber: manager.manager_number,
    username: manager.username,
    isPrimary: manager.is_primary,
    status: manager.status,
    isActive: manager.is_active,
    isDeleted: manager.is_deleted ?? false,
    createdAt: manager.created_at,
    approvedAt: manager.approved_at,
  };
}

// --------------------------------------------------
// AUDIT LOG
// --------------------------------------------------

async function writeManagerAudit(
  client,
  manager,
  action,
  beforeData,
  afterData
) {
  await client.query(
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
     VALUES ($1, $2, $3, $4, 'manager_account', $5, $6, $7, $8)`,
    [
      manager.business_id,
      manager.id,
      manager.username,
      manager.manager_number,
      String(afterData.id ?? beforeData.id),
      action,
      JSON.stringify(beforeData),
      JSON.stringify(afterData),
    ]
  );
}

// --------------------------------------------------
// BUSINESS CREDENTIAL VERIFICATION
// --------------------------------------------------

async function verifyBusinessCredentials(
  client,
  businessId,
  businessUsername,
  businessPassword
) {
  if (!businessId || !businessUsername || !businessPassword) {
    return null;
  }

  const result = await client.query(
    `SELECT id, "isActive"
     FROM "Business"
     WHERE id = $1
       AND LOWER(username) = LOWER($2)
       AND password = $3`,
    [businessId, businessUsername.trim(), businessPassword]
  );

  if (!result.rows.length || !result.rows[0].isActive) {
    return null;
  }

  return result.rows[0];
}

// --------------------------------------------------
// GET MANAGER STATUS
// GET /api/manager-passwords/status?businessId=B60001
// --------------------------------------------------

router.get("/status", async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json({
        message: "Business ID is required.",
      });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE is_deleted = false
         )::int AS total,

         COUNT(*) FILTER (
           WHERE status = 'approved'
           AND is_active = true
           AND is_deleted = false
         )::int AS approved

       FROM manager_accounts
       WHERE business_id = $1`,
      [businessId]
    );

    res.json({
      exists: Number(result.rows[0].total) > 0,
      total: Number(result.rows[0].total),
      approved: Number(result.rows[0].approved),
    });
  } catch (error) {
    console.error("Manager status error:", error);

    res.status(500).json({
      message: "Could not check manager accounts.",
    });
  }
});

// --------------------------------------------------
// FIRST MANAGER SETUP
// POST /api/manager-passwords/setup
// --------------------------------------------------

router.post("/setup", async (req, res) => {
  const {
    businessId,
    businessUsername,
    businessPassword,
    username,
    password,
  } = req.body;

  const validationError = validateManagerDetails(username, password);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  if (!businessId || !businessUsername || !businessPassword) {
    return res.status(400).json({
      message: "Business login details are required to set up the first manager.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`manager-accounts-${businessId}`]
    );

    const business = await verifyBusinessCredentials(
      client,
      businessId,
      businessUsername,
      businessPassword
    );

    if (!business) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        message: "Business username or password is incorrect.",
      });
    }

    const existing = await client.query(
      `SELECT id
       FROM manager_accounts
       WHERE business_id = $1
       LIMIT 1`,
      [businessId]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message: "Manager accounts already exist. Please log in instead.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const inserted = await client.query(
      `INSERT INTO manager_accounts
         (
           business_id,
           manager_number,
           username,
           password_hash,
           is_primary,
           status,
           is_active,
           is_deleted,
           created_at,
           approved_at
         )
       VALUES ($1, 1, $2, $3, true, 'approved', true, false, NOW(), NOW())
       RETURNING *`,
      [businessId, username.trim(), passwordHash]
    );

    await client.query("COMMIT");

    const manager = inserted.rows[0];
    const token = createManagerToken(manager);

    return res.status(201).json({
      message: "Primary Manager account created successfully.",
      token,
      manager: publicManager(manager),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Manager setup error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "That manager username is already in use.",
      });
    }

    return res.status(500).json({
      message: "Could not create the Primary Manager account.",
    });
  } finally {
    client.release();
  }
});

// --------------------------------------------------
// MANAGER LOGIN
// POST /api/manager-passwords/login
// --------------------------------------------------

router.post("/login", async (req, res) => {
  try {
    const { businessId, username, password } = req.body;

    if (!businessId || !username || !password) {
      return res.status(400).json({
        message: "Business ID, username and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT
         m.*,
         b."isActive" AS business_active
       FROM manager_accounts m
       INNER JOIN "Business" b
          ON b.id = m.business_id
       WHERE m.business_id = $1
         AND LOWER(m.username) = LOWER($2)
       LIMIT 1`,
      [businessId, username.trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        message: "Incorrect manager username or password.",
      });
    }

    const manager = result.rows[0];

    if (manager.is_deleted) {
      return res.status(403).json({
        message: "This manager account has been deleted.",
      });
    }

    if (
      manager.status !== "approved" ||
      !manager.is_active ||
      !manager.business_active
    ) {
      return res.status(403).json({
        message:
          manager.status === "pending"
            ? "Your manager registration is waiting for Primary Manager approval."
            : manager.status === "rejected"
              ? "Your manager registration was rejected."
              : "This manager account is inactive or not approved.",
      });
    }

    let passwordIsValid = false;

    if (manager.password_hash) {
      passwordIsValid = await bcrypt.compare(
        password,
        manager.password_hash
      );
    } else if (manager.legacy_password !== null) {
      passwordIsValid = password === manager.legacy_password;

      if (passwordIsValid) {
        const newHash = await bcrypt.hash(password, 12);

        await pool.query(
          `UPDATE manager_accounts
           SET password_hash = $1,
               legacy_password = NULL,
               updated_at = NOW()
           WHERE id = $2`,
          [newHash, manager.id]
        );

        manager.password_hash = newHash;
        manager.legacy_password = null;
      }
    }

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Incorrect manager username or password.",
      });
    }

    const token = createManagerToken(manager);

    return res.json({
      message: "Manager login successful.",
      token,
      manager: publicManager(manager),
    });
  } catch (error) {
    console.error("Manager login error:", error);

    return res.status(500).json({
      message: "Manager login failed.",
    });
  }
});

// --------------------------------------------------
// ADDITIONAL MANAGER REGISTRATION
// POST /api/manager-passwords/register
// --------------------------------------------------

router.post("/register", async (req, res) => {
  const {
    businessId,
    businessUsername,
    businessPassword,
    username,
    password,
  } = req.body;

  const validationError = validateManagerDetails(username, password);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  if (!businessId || !businessUsername || !businessPassword) {
    return res.status(400).json({
      message: "Business login details are required to register a manager.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`manager-accounts-${businessId}`]
    );

    const business = await verifyBusinessCredentials(
      client,
      businessId,
      businessUsername,
      businessPassword
    );

    if (!business) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        message: "Business username or password is incorrect.",
      });
    }

    const existingManagers = await client.query(
      `SELECT id
       FROM manager_accounts
       WHERE business_id = $1
       LIMIT 1`,
      [businessId]
    );

    if (!existingManagers.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message: "The Primary Manager must be set up before additional managers can register.",
      });
    }

    const duplicate = await client.query(
      `SELECT id
       FROM manager_accounts
       WHERE business_id = $1
         AND LOWER(username) = LOWER($2)
       LIMIT 1`,
      [businessId, username.trim()]
    );

    if (duplicate.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        message: "That manager username is already registered for this business.",
      });
    }

    const numberResult = await client.query(
      `SELECT COALESCE(MAX(manager_number), 0) + 1 AS next_number
       FROM manager_accounts
       WHERE business_id = $1`,
      [businessId]
    );

    const managerNumber = Number(numberResult.rows[0].next_number);
    const passwordHash = await bcrypt.hash(password, 12);

    const inserted = await client.query(
      `INSERT INTO manager_accounts
         (
           business_id,
           manager_number,
           username,
           password_hash,
           is_primary,
           status,
           is_active,
           is_deleted,
           created_at
         )
       VALUES ($1, $2, $3, $4, false, 'pending', true, false, NOW())
       RETURNING *`,
      [
        businessId,
        managerNumber,
        username.trim(),
        passwordHash,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Registration submitted. The Primary Manager must approve your account.",
      manager: publicManager(inserted.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Manager registration error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "That manager username or number is already in use.",
      });
    }

    return res.status(500).json({
      message: "Could not register the manager.",
    });
  } finally {
    client.release();
  }
});

// --------------------------------------------------
// GET CURRENT MANAGER
// GET /api/manager-passwords/me
// --------------------------------------------------

router.get("/me", requireManager, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM manager_accounts
       WHERE id = $1
         AND is_deleted = false`,
      [req.manager.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Manager account not found.",
      });
    }

    return res.json({
      manager: publicManager(result.rows[0]),
    });
  } catch (error) {
    console.error("Manager profile error:", error);

    return res.status(500).json({
      message: "Could not load manager profile.",
    });
  }
});

// --------------------------------------------------
// GET ALL MANAGER ACCOUNTS
// PRIMARY MANAGER ONLY
// GET /api/manager-passwords/accounts
// --------------------------------------------------

router.get(
  "/accounts",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM manager_accounts
         WHERE business_id = $1
         ORDER BY manager_number ASC`,
        [req.manager.businessId]
      );

      return res.json({
        managers: result.rows.map(publicManager),
      });
    } catch (error) {
      console.error("Manager accounts error:", error);

      return res.status(500).json({
        message: "Could not load manager accounts.",
      });
    }
  }
);

// --------------------------------------------------
// GET PENDING MANAGERS
// PRIMARY MANAGER ONLY
// --------------------------------------------------

router.get(
  "/pending",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM manager_accounts
         WHERE business_id = $1
           AND status = 'pending'
           AND is_deleted = false
         ORDER BY created_at ASC`,
        [req.manager.businessId]
      );

      return res.json({
        managers: result.rows.map(publicManager),
      });
    } catch (error) {
      console.error("Pending managers error:", error);

      return res.status(500).json({
        message: "Could not load pending registrations.",
      });
    }
  }
);

// --------------------------------------------------
// APPROVE MANAGER
// PRIMARY MANAGER ONLY
// POST /api/manager-passwords/accounts/:id/approve
// --------------------------------------------------

router.post(
  "/accounts/:id/approve",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const target = await client.query(
        `SELECT *
         FROM manager_accounts
         WHERE id = $1
           AND business_id = $2
         FOR UPDATE`,
        [req.params.id, req.manager.businessId]
      );

      if (!target.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Manager account not found.",
        });
      }

      const manager = target.rows[0];

      if (manager.is_primary || manager.is_deleted) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This manager account cannot be approved.",
        });
      }

      if (manager.status !== "pending") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This manager is not awaiting approval.",
        });
      }

      const updated = await client.query(
        `UPDATE manager_accounts
         SET status = 'approved',
             is_active = true,
             approved_at = NOW(),
             approved_by = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [req.manager.id, manager.id]
      );

      await writeManagerAudit(
        client,
        req.manager,
        "approve",
        publicManager(manager),
        publicManager(updated.rows[0])
      );

      await client.query("COMMIT");

      return res.json({
        message: "Manager approved successfully.",
        manager: publicManager(updated.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Approve manager error:", error);

      return res.status(500).json({
        message: "Could not approve manager.",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// REJECT MANAGER
// PRIMARY MANAGER ONLY
// POST /api/manager-passwords/accounts/:id/reject
// --------------------------------------------------

router.post(
  "/accounts/:id/reject",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const target = await client.query(
        `SELECT *
         FROM manager_accounts
         WHERE id = $1
           AND business_id = $2
         FOR UPDATE`,
        [req.params.id, req.manager.businessId]
      );

      if (!target.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Manager account not found.",
        });
      }

      const manager = target.rows[0];

      if (
        manager.is_primary ||
        manager.is_deleted ||
        manager.status !== "pending"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Only pending additional managers can be rejected.",
        });
      }

      const updated = await client.query(
        `UPDATE manager_accounts
         SET status = 'rejected',
             is_active = false,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [manager.id]
      );

      await writeManagerAudit(
        client,
        req.manager,
        "reject",
        publicManager(manager),
        publicManager(updated.rows[0])
      );

      await client.query("COMMIT");

      return res.json({
        message: "Manager registration rejected.",
        manager: publicManager(updated.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Reject manager error:", error);

      return res.status(500).json({
        message: "Could not reject manager.",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// DEACTIVATE MANAGER
// PRIMARY MANAGER ONLY
// POST /api/manager-passwords/accounts/:id/deactivate
// --------------------------------------------------

router.post(
  "/accounts/:id/deactivate",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const target = await client.query(
        `SELECT *
         FROM manager_accounts
         WHERE id = $1
           AND business_id = $2
         FOR UPDATE`,
        [req.params.id, req.manager.businessId]
      );

      if (!target.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Manager account not found.",
        });
      }

      const manager = target.rows[0];

      if (manager.is_primary || manager.is_deleted) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This manager account cannot be deactivated.",
        });
      }

      if (manager.status !== "approved") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Only approved managers can be deactivated.",
        });
      }

      const updated = await client.query(
        `UPDATE manager_accounts
         SET is_active = false,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [manager.id]
      );

      await writeManagerAudit(
        client,
        req.manager,
        "deactivate",
        publicManager(manager),
        publicManager(updated.rows[0])
      );

      await client.query("COMMIT");

      return res.json({
        message: "Manager account deactivated.",
        manager: publicManager(updated.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Deactivate manager error:", error);

      return res.status(500).json({
        message: "Could not deactivate manager.",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// REACTIVATE MANAGER
// PRIMARY MANAGER ONLY
// POST /api/manager-passwords/accounts/:id/reactivate
// --------------------------------------------------

router.post(
  "/accounts/:id/reactivate",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const target = await client.query(
        `SELECT *
         FROM manager_accounts
         WHERE id = $1
           AND business_id = $2
         FOR UPDATE`,
        [req.params.id, req.manager.businessId]
      );

      if (!target.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Manager account not found.",
        });
      }

      const manager = target.rows[0];

      if (manager.is_primary || manager.is_deleted) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This manager account cannot be reactivated.",
        });
      }

      if (manager.status !== "approved") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Only previously approved managers can be reactivated.",
        });
      }

      const updated = await client.query(
        `UPDATE manager_accounts
         SET is_active = true,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [manager.id]
      );

      await writeManagerAudit(
        client,
        req.manager,
        "reactivate",
        publicManager(manager),
        publicManager(updated.rows[0])
      );

      await client.query("COMMIT");

      return res.json({
        message: "Manager account reactivated successfully.",
        manager: publicManager(updated.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Reactivate manager error:", error);

      return res.status(500).json({
        message: "Could not reactivate manager.",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// SOFT DELETE MANAGER
// PRIMARY MANAGER ONLY
// POST /api/manager-passwords/accounts/:id/delete
// --------------------------------------------------

router.post(
  "/accounts/:id/delete",
  requireManager,
  requirePrimaryManager,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const target = await client.query(
        `SELECT *
         FROM manager_accounts
         WHERE id = $1
           AND business_id = $2
         FOR UPDATE`,
        [req.params.id, req.manager.businessId]
      );

      if (!target.rows.length) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Manager account not found.",
        });
      }

      const manager = target.rows[0];

      if (manager.is_primary) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "The Primary Manager account cannot be deleted.",
        });
      }

      if (manager.is_deleted) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "This manager account has already been deleted.",
        });
      }

      const updated = await client.query(
        `UPDATE manager_accounts
         SET is_deleted = true,
             is_active = false,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [manager.id]
      );

      await writeManagerAudit(
        client,
        req.manager,
        "delete",
        publicManager(manager),
        publicManager(updated.rows[0])
      );

      await client.query("COMMIT");

      return res.json({
        message: "Manager account deleted. Historical records have been preserved.",
        manager: publicManager(updated.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Delete manager error:", error);

      return res.status(500).json({
        message: "Could not delete manager.",
      });
    } finally {
      client.release();
    }
  }
);

// --------------------------------------------------
// CHANGE MANAGER PASSWORD
// PATCH /api/manager-passwords/change-password
// PATCH /api/manager-passwords/change
// --------------------------------------------------

async function changeManagerPassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      !currentPassword ||
      !newPassword ||
      newPassword.length < MIN_PASSWORD_LENGTH
    ) {
      return res.status(400).json({
        message: "Enter your current password and a new password of at least 6 characters.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM manager_accounts
       WHERE id = $1
         AND is_deleted = false`,
      [req.manager.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Manager account not found.",
      });
    }

    const manager = result.rows[0];

    const currentIsValid = manager.password_hash
      ? await bcrypt.compare(currentPassword, manager.password_hash)
      : currentPassword === manager.legacy_password;

    if (!currentIsValid) {
      return res.status(401).json({
        message: "Current password is incorrect.",
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE manager_accounts
       SET password_hash = $1,
           legacy_password = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newHash, req.manager.id]
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
}

router.patch(
  "/change-password",
  requireManager,
  changeManagerPassword
);

router.patch(
  "/change",
  requireManager,
  changeManagerPassword
);

export default router;
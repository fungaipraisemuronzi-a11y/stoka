
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;

const isValidUsername = (username) =>
  typeof username === "string" &&
  USERNAME_REGEX.test(username.trim()) &&
  username.trim().length <= 15;

// Register a business
// POST /api/auth/register
router.post("/register", async (req, res) => {
  const {
    businessName,
    location,
    phone,
    username,
    password,
    confirmPassword,
  } = req.body ?? {};

  if (
    typeof businessName !== "string" ||
    typeof location !== "string" ||
    typeof phone !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string" ||
    !businessName.trim() ||
    !location.trim() ||
    !phone.trim() ||
    !username.trim() ||
    !password ||
    !confirmPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Please fill in all fields.",
    });
  }

  if (
    businessName.trim().length > 25 ||
    location.trim().length > 25 ||
    phone.trim().length > 12 ||
    username.trim().length > 15 ||
    password.length > 15
  ) {
    return res.status(400).json({
      success: false,
      message: "One or more fields are too long.",
    });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({
      success: false,
      message:
        "Username must contain only letters and numbers, with no spaces or special characters.",
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match.",
    });
  }

  const cleanUsername = username.trim().toLowerCase();
  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Prevent simultaneous registrations from claiming the same username.
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [60002]
    );

    // Also lock ID generation.
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [60001]
    );

    const existing = await client.query(
      `SELECT id
       FROM "Business"
       WHERE LOWER(username) = $1`,
      [cleanUsername]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Username already exists. Please choose another.",
      });
    }

    const nextIdResult = await client.query(`
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(id FROM 4) AS BIGINT)),
        0
      ) + 1 AS next_number
      FROM "Business"
      WHERE id ~ '^B60[0-9]+$'
    `);

    const nextNumber = Number(
      nextIdResult.rows[0].next_number
    );

    const businessId = `B60${String(nextNumber).padStart(3, "0")}`;

    const result = await client.query(
      `INSERT INTO "Business"
        (
          id,
          "businessName",
          location,
          phone,
          username,
          password,
          "isActive"
        )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING
         id,
         "businessName",
         location,
         phone,
         username,
         "isActive",
         "createdAt"`,
      [
        businessId,
        businessName.trim(),
        location.trim(),
        phone.trim(),
        cleanUsername,
        password,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Business registered successfully.",
      business: result.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    // Handles a duplicate username if the database unique index catches it.
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists. Please choose another.",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Registration failed.",
    });
  } finally {
    if (client) client.release();
  }
});

// Business login
// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter your username and password.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         "businessName",
         location,
         phone,
         username,
         "isActive"
       FROM "Business"
       WHERE LOWER(username) = $1
         AND password = $2`,
      [username.trim().toLowerCase(), password]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username or password.",
      });
    }

    const business = result.rows[0];

    if (!business.isActive) {
      return res.status(403).json({
        success: false,
        message: "This business account is inactive.",
      });
    }

    return res.json({
      success: true,
      message: "Login successful.",
      business,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
});

// Change business account password
// POST /api/auth/change-password
router.post("/change-password", async (req, res) => {
  const {
    businessId,
    currentPassword,
    newPassword,
  } = req.body ?? {};

  if (
    typeof businessId !== "string" ||
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !businessId.trim() ||
    !currentPassword ||
    !newPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Please fill in all password fields.",
    });
  }

  if (newPassword.length > 15) {
    return res.status(400).json({
      success: false,
      message: "Password cannot exceed 15 characters.",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "The new password must differ from the current password.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE "Business"
       SET password = $1
       WHERE id = $2
         AND password = $3
       RETURNING id`,
      [
        newPassword,
        businessId.trim(),
        currentPassword,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message:
          "Current business password is incorrect, or the business was not found.",
      });
    }

    return res.json({
      success: true,
      message: "Business account password changed successfully.",
    });
  } catch (error) {
    console.error("Business password change error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not change business password. Please try again.",
    });
  }
});

// Update business name and username
// PATCH /api/auth/profile
router.patch("/profile", async (req, res) => {
  const {
    businessId,
    businessName,
    username,
    currentPassword,
  } = req.body ?? {};

  if (
    typeof businessId !== "string" ||
    typeof businessName !== "string" ||
    typeof username !== "string" ||
    typeof currentPassword !== "string" ||
    !businessId.trim() ||
    !businessName.trim() ||
    !username.trim() ||
    !currentPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Please complete all required fields.",
    });
  }

  if (
    businessName.trim().length > 25 ||
    username.trim().length > 15
  ) {
    return res.status(400).json({
      success: false,
      message: "Business name or username is too long.",
    });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({
      success: false,
      message:
        "Username must contain only letters and numbers, with no spaces or special characters.",
    });
  }

  const cleanUsername = username.trim().toLowerCase();
  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Use the same lock as registration to protect username uniqueness.
    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [60002]
    );

    const current = await client.query(
      `SELECT id
       FROM "Business"
       WHERE id = $1 AND password = $2`,
      [businessId.trim(), currentPassword]
    );

    if (current.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        success: false,
        message: "Current business password is incorrect.",
      });
    }

    const duplicate = await client.query(
      `SELECT id
       FROM "Business"
       WHERE LOWER(username) = $1
         AND id <> $2`,
      [cleanUsername, businessId.trim()]
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Username already exists. Please choose another.",
      });
    }

    const result = await client.query(
      `UPDATE "Business"
       SET "businessName" = $1,
           username = $2
       WHERE id = $3
       RETURNING
         id,
         "businessName",
         location,
         phone,
         username,
         "isActive"`,
      [
        businessName.trim(),
        cleanUsername,
        businessId.trim(),
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Business profile updated successfully.",
      business: result.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists. Please choose another.",
      });
    }

    console.error("Business profile update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not update business profile.",
    });
  } finally {
    if (client) client.release();
  }
});

// Delete a business account
// DELETE /api/auth/delete/:businessId
// Requires the current business password.
router.delete("/delete/:businessId", async (req, res) => {
  const { businessId } = req.params;
  const { currentPassword } = req.body ?? {};

  if (
    !businessId?.trim() ||
    typeof currentPassword !== "string" ||
    !currentPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Business ID and current password are required.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM "Business"
       WHERE id = $1
         AND password = $2
       RETURNING id`,
      [businessId.trim(), currentPassword]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password or business account not found.",
      });
    }

    return res.json({
      success: true,
      message: "Business account deleted successfully.",
      businessId: result.rows[0].id,
    });
  } catch (error) {
    // Related records may reference this business.
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "This business has existing records and cannot be deleted until its related records are handled.",
      });
    }

    console.error("Business deletion error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not delete the business account.",
    });
  }
});

export default router;

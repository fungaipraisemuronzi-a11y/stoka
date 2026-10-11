
import express from "express";
import pool from "../config/database.js";

const router = express.Router();

// Register a business
router.post("/register", async (req, res) => {
  const {
    businessName,
    location,
    phone,
    username,
    password,
  } = req.body ?? {};

  if (
    typeof businessName !== "string" ||
    typeof location !== "string" ||
    typeof phone !== "string" ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    !businessName.trim() ||
    !location.trim() ||
    !phone.trim() ||
    !username.trim() ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "Please fill in all fields.",
    });
  }

  if (
    businessName.length > 15 ||
    location.length > 200 ||
    phone.length > 12 ||
    username.length > 15 ||
    password.length > 15
  ) {
    return res.status(400).json({
      success: false,
      message: "One or more fields are too long.",
    });
  }

  const cleanUsername = username.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [60001]
    );

    const existing = await client.query(
      'SELECT id FROM "Business" WHERE username = $1',
      [cleanUsername]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Username already exists.",
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
    await client.query("ROLLBACK");

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Registration failed. Check your database tables and connection.",
    });
  } finally {
    client.release();
  }
});

// Business login
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
       WHERE username = $1 AND password = $2`,
      [username.trim().toLowerCase(), password]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username or password.",
      });
    }

    const business = result.rows[0];

    return res.json({
      success: true,
      message: "Login successful.",
      business,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Login failed. Check your database connection and tables.",
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
      message:
        "The new password must differ from the current password.",
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
    console.error(
      "Business password change error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not change business password. Please try again.",
    });
  }
});

export default router;
